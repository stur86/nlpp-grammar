package tree_sitter_nlpp_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_nlpp "github.com/stur86/nlpp-grammar/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_nlpp.Language())
	if language == nil {
		t.Errorf("Error loading NL++ grammar")
	}
}
