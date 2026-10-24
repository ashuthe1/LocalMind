package services

import (
	"strings"
	"testing"
)

func runSplitter(t *testing.T, chunks []string) (string, string) {
	var content, reasoning strings.Builder
	sp := newThinkSplitter(
		func(s string) error { content.WriteString(s); return nil },
		func(s string) error { reasoning.WriteString(s); return nil },
	)
	for _, c := range chunks {
		if err := sp.Write(c); err != nil {
			t.Fatal(err)
		}
	}
	if err := sp.Flush(); err != nil {
		t.Fatal(err)
	}
	return content.String(), reasoning.String()
}

func TestThinkSplitterBasic(t *testing.T) {
	c, r := runSplitter(t, []string{"<think>I should ", "say hi</think>\n\nHello!"})
	if r != "I should say hi" {
		t.Fatalf("reasoning = %q", r)
	}
	if c != "Hello!" {
		t.Fatalf("content = %q", c)
	}
}

func TestThinkSplitterSplitTags(t *testing.T) {
	c, r := runSplitter(t, []string{"<th", "ink>deep", " thought</thi", "nk>answer ", "here"})
	if r != "deep thought" || c != "answer here" {
		t.Fatalf("got content=%q reasoning=%q", c, r)
	}
}

func TestThinkSplitterNoTags(t *testing.T) {
	c, r := runSplitter(t, []string{"Just ", "a plain <b>answer</b>"})
	if r != "" || c != "Just a plain <b>answer</b>" {
		t.Fatalf("got content=%q reasoning=%q", c, r)
	}
}

func TestThinkSplitterMissingOpenTag(t *testing.T) {
	c, r := runSplitter(t, []string{"reasoning only</think>final"})
	if r != "reasoning only" || c != "final" {
		t.Fatalf("got content=%q reasoning=%q", c, r)
	}
}

func TestThinkSplitterUnclosed(t *testing.T) {
	c, r := runSplitter(t, []string{"<think>never ends"})
	if r != "never ends" || c != "" {
		t.Fatalf("got content=%q reasoning=%q", c, r)
	}
}
