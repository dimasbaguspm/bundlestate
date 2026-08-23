package trace

import "testing"

func TestFindCircularGroups(t *testing.T) {
	g := &ModuleGraph{
		Nodes: []ModuleNode{
			{ID: "a", Local: true},
			{ID: "b", Local: true},
			{ID: "c", Local: true},
			{ID: "d", Local: true},
			{ID: "ext", Local: false}, // node_modules module, ignored
		},
		Edges: [][2]string{
			{"a", "b"},
			{"b", "c"},
			{"c", "a"}, // cycle a->b->c->a
			{"d", "a"},
			{"a", "ext"}, // edge into node_modules, ignored for cycles
		},
	}
	groups := FindCircularGroups(g)
	if len(groups) != 1 {
		t.Fatalf("expected 1 cycle, got %d: %v", len(groups), groups)
	}
	if len(groups[0]) != 3 {
		t.Fatalf("expected cycle of 3, got %v", groups[0])
	}
	path := TraceCycle(groups[0], g)
	if path[0] != path[len(path)-1] {
		t.Fatalf("cycle path not closed: %v", path)
	}
}

func TestFindCircularGroupsNoCycle(t *testing.T) {
	g := &ModuleGraph{
		Nodes: []ModuleNode{{ID: "a", Local: true}, {ID: "b", Local: true}},
		Edges: [][2]string{{"a", "b"}},
	}
	if got := FindCircularGroups(g); len(got) != 0 {
		t.Fatalf("expected no cycles, got %v", got)
	}
}

func TestExtractImports(t *testing.T) {
	src := `import { x } from "./x";\nimport y from "./y";\nexport { z } from "./z";\nconst w = require("./w");\nimport React from "react";\n`
	got := extractImports(src)
	want := []string{"./x", "./y", "./z", "react", "./w"}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
}
