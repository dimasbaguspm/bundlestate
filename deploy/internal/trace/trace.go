// Package trace analyzes a JS/TS project directory, builds the module-level
// import graph from import/require statements, and detects circular
// dependencies among application (local, non-node_modules) modules.
//
// The cycle detection is a faithful Go port of the frontend's
// src/utils/cycles.ts (Tarjan's strongly-connected components): only LOCAL
// modules are considered, cycles through node_modules are ignored, and each
// returned group is one cycle's members sorted by size then lexically.
package trace

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// ModuleNode is one source file recovered from the project.
type ModuleNode struct {
	ID    string // canonical module id (full path, slash-normalized)
	Local bool   // true when outside node_modules
}

// ModuleGraph is the extracted import graph.
type ModuleGraph struct {
	Nodes []ModuleNode
	Edges [][2]string // [from, to] directed import edges (local ids)
	Root  string
}

var (
	importRe  = regexp.MustCompile(`(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]`)
	requireRe = regexp.MustCompile(`require\(\s*['"]([^'"]+)['"]\s*\)`)
	// matches TS/JS source files only
	srcExtRe = regexp.MustCompile(`\.(tsx?|jsx?|mjs|cjs)$`)
)

// Analyze walks root recursively, parsing every source file for static imports
// and building the import graph. Symlinks and node_modules are skipped.
func Analyze(root string) (*ModuleGraph, error) {
	root = filepath.Clean(root)
	g := &ModuleGraph{Root: root}

	// First pass: enumerate local module ids (relative path keys).
	idByPath := map[string]string{} // absolute path -> id
	_ = filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if d.Name() == "node_modules" || strings.HasPrefix(d.Name(), ".") && d.Name() != "." {
				return filepath.SkipDir
			}
			return nil
		}
		if !srcExtRe.MatchString(p) {
			return nil
		}
		rel, _ := filepath.Rel(root, p)
		id := filepath.ToSlash(rel)
		idByPath[p] = id
		g.Nodes = append(g.Nodes, ModuleNode{ID: id, Local: true})
		return nil
	})

	// Second pass: resolve imports per file into edges.
	seen := map[[2]string]bool{}
	for _, n := range g.Nodes {
		abs := filepath.Join(root, filepath.FromSlash(n.ID))
		data, err := os.ReadFile(abs)
		if err != nil {
			continue
		}
		imports := extractImports(string(data))
		for _, spec := range imports {
			target := resolveImport(root, abs, spec, idByPath)
			if target == "" {
				continue // external / node_modules package — not a local edge
			}
			edge := [2]string{n.ID, target}
			if edge[0] == edge[1] {
				continue
			}
			if !seen[edge] {
				seen[edge] = true
				g.Edges = append(g.Edges, edge)
			}
		}
	}
	return g, nil
}

// extractImports returns the module specifiers referenced by static
// import/export-from/require statements in src.
func extractImports(src string) []string {
	var out []string
	for _, m := range importRe.FindAllStringSubmatch(src, -1) {
		out = append(out, m[1])
	}
	for _, m := range requireRe.FindAllStringSubmatch(src, -1) {
		out = append(out, m[1])
	}
	return out
}

// resolveImport maps a raw import specifier to a local module id, or "" if the
// import points at an external package (bare specifier not resolved locally).
func resolveImport(root, fromFile, spec string, idByPath map[string]string) string {
	if strings.HasPrefix(spec, ".") {
		// relative import
		base := filepath.Dir(fromFile)
		resolved := filepath.Clean(filepath.Join(base, spec))
		// try with common extensions if no extension
		if _, ok := idByPath[resolved]; !ok && !strings.Contains(filepath.Base(resolved), ".") {
			for _, ext := range []string{".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"} {
				if _, ok := idByPath[resolved+ext]; ok {
					resolved += ext
					break
				}
			}
			// also try index files
			if _, ok := idByPath[resolved]; !ok {
				for _, idx := range []string{"/index.ts", "/index.tsx", "/index.js", "/index.jsx"} {
					if _, ok := idByPath[resolved+idx]; ok {
						resolved += idx
						break
					}
				}
			}
		}
		if id, ok := idByPath[resolved]; ok {
			return id
		}
		return ""
	}
	if strings.HasPrefix(spec, "/") {
		resolved := filepath.Clean(filepath.Join(root, spec))
		if id, ok := idByPath[resolved]; ok {
			return id
		}
		return ""
	}
	// bare specifier (e.g. "react", "lodash/merge") -> external package
	return ""
}

// FindCircularGroups runs Tarjan's SCC over the local graph and returns each
// cycle (size > 1) as a sorted group of module ids, ordered by size desc then
// lexically. This mirrors src/utils/cycles.ts findCircularGroups.
func FindCircularGroups(g *ModuleGraph) [][]string {
	ids := make([]string, 0, len(g.Nodes))
	idx := map[string]int{}
	for _, n := range g.Nodes {
		if n.Local {
			idx[n.ID] = len(ids)
			ids = append(ids, n.ID)
		}
	}
	adj := make([][]int, len(ids))
	for _, e := range g.Edges {
		f, ok1 := idx[e[0]]
		t, ok2 := idx[e[1]]
		if ok1 && ok2 {
			adj[f] = append(adj[f], t)
		}
	}

	index := make([]int, len(ids))
	for i := range index {
		index[i] = -1
	}
	low := make([]int, len(ids))
	onStack := make([]bool, len(ids))
	stack := []int{}
	var groups [][]string
	counter := 0

	var strongconnect func(v int)
	strongconnect = func(v int) {
		index[v] = counter
		low[v] = counter
		counter++
		stack = append(stack, v)
		onStack[v] = true
		for _, w := range adj[v] {
			if index[w] == -1 {
				strongconnect(w)
				if low[w] < low[v] {
					low[v] = low[w]
				}
			} else if onStack[w] {
				if index[w] < low[v] {
					low[v] = index[w]
				}
			}
		}
		if low[v] == index[v] {
			var comp []int
			for {
				w := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				onStack[w] = false
				comp = append(comp, w)
				if w == v {
					break
				}
			}
			if len(comp) > 1 {
				group := make([]string, 0, len(comp))
				for _, n := range comp {
					group = append(group, ids[n])
				}
				sort.Strings(group)
				groups = append(groups, group)
			}
		}
	}

	for v := 0; v < len(ids); v++ {
		if index[v] == -1 {
			strongconnect(v)
		}
	}
	sort.Slice(groups, func(i, j int) bool {
		if len(groups[i]) != len(groups[j]) {
			return len(groups[i]) > len(groups[j])
		}
		return groups[i][0] < groups[j][0]
	})
	return groups
}

// TraceCycle orders one circular group into a closed path (A→B→C→A) by walking
// the actual import edges. Mirrors src/utils/cycles.ts traceCycle.
func TraceCycle(group []string, g *ModuleGraph) []string {
	if len(group) < 2 {
		out := make([]string, len(group))
		copy(out, group)
		return out
	}
	adj := map[string][]string{}
	for _, id := range group {
		adj[id] = []string{}
	}
	for _, e := range g.Edges {
		if _, ok := adj[e[0]]; ok {
			if _, ok2 := adj[e[1]]; ok2 {
				adj[e[0]] = append(adj[e[0]], e[1])
			}
		}
	}
	path := []string{group[0]}
	seen := map[string]bool{group[0]: true}
	current := group[0]
	for step := 0; step < len(group); step++ {
		next := ""
		for _, n := range adj[current] {
			if !seen[n] || n == group[0] {
				next = n
				break
			}
		}
		if next == "" {
			break
		}
		path = append(path, next)
		if next == group[0] {
			break
		}
		seen[next] = true
		current = next
	}
	if path[len(path)-1] != group[0] {
		path = append(path, group[0])
	}
	return path
}
