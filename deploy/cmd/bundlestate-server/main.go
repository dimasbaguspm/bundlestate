// Command bundlestate-server is the deployable Golang binary for bundlestate.
//
// It exposes two subcommands via cobra:
//
//   - serve  : run the static SPA HTTP server (default port 80) with catch-all
//     SPA routing and a /healthz probe.
//   - trace  : analyze a JS/TS project directory, build the module import
//     graph, detect circular dependencies among local modules, and
//     print a CLI report.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/dimasbaguspm/bundlestate/deploy/internal/serve"
	"github.com/dimasbaguspm/bundlestate/deploy/internal/trace"
	"github.com/spf13/cobra"
)

func main() {
	if err := rootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func rootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "bundlestate-server",
		Short: "bundlestate deploy server: serve the SPA and trace import graphs",
		Long: "bundlestate-server is the deployable binary for bundlestate.\n" +
			"It can serve the built SPA (catch-all routing on :80) or trace a\n" +
			"JS/TS project's module import graph for circular dependencies.",
		SilenceUsage: true,
	}

	root.AddCommand(serveCmd())
	root.AddCommand(traceCmd())
	return root
}

func serveCmd() *cobra.Command {
	var addr, dir string
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Serve the built SPA over HTTP (default :80) with catch-all routing",
		RunE: func(cmd *cobra.Command, args []string) error {
			return serve.Run(serve.Config{Addr: addr, Dir: dir, Healthy: true})
		},
	}
	cmd.Flags().StringVar(&addr, "addr", ":80", "listen address (port 80 by default)")
	cmd.Flags().StringVar(&dir, "dir", "dist", "path to the built SPA directory")
	return cmd
}

func traceCmd() *cobra.Command {
	var target string
	cmd := &cobra.Command{
		Use:   "trace [target]",
		Short: "Analyze a JS/TS project for its import graph and circular deps",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				target = args[0]
			}
			if target == "" {
				target = "."
			}
			return runTrace(target)
		},
	}
	cmd.Flags().StringVar(&target, "target", "", "project directory to analyze (default: current dir)")
	return cmd
}

func runTrace(target string) error {
	abs, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	g, err := trace.Analyze(abs)
	if err != nil {
		return err
	}
	groups := trace.FindCircularGroups(g)

	fmt.Printf("bundlestate trace — import graph\n")
	fmt.Printf("  target : %s\n", abs)
	fmt.Printf("  modules: %d\n", len(g.Nodes))
	fmt.Printf("  edges  : %d\n", len(g.Edges))

	if len(groups) == 0 {
		fmt.Println("\nNo circular dependencies detected. \u2713")
		return nil
	}

	fmt.Printf("\nFound %d circular dependency group(s):\n\n", len(groups))
	for i, grp := range groups {
		fmt.Printf("  [%d] cycle of %d modules:\n", i+1, len(grp))
		path := trace.TraceCycle(grp, g)
		for j, id := range path {
			arrow := "\u2192"
			if j == len(path)-1 {
				arrow = ""
			}
			fmt.Printf("      %s %s\n", id, arrow)
		}
		fmt.Println()
	}
	return nil
}
