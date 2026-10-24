package services

import "strings"

// thinkSplitter routes text inside <think>…</think> tags to a reasoning callback
// and everything else to a content callback. It is safe across chunk boundaries.
type thinkSplitter struct {
	buf         strings.Builder
	inThink     bool
	emittedText bool
	onContent   func(string) error
	onReasoning func(string) error
	openTag     string
	closeTag    string
}

func newThinkSplitter(onContent, onReasoning func(string) error) *thinkSplitter {
	return &thinkSplitter{onContent: onContent, onReasoning: onReasoning, openTag: "<think>", closeTag: "</think>"}
}

// Write feeds a chunk of model output.
func (t *thinkSplitter) Write(chunk string) error {
	t.buf.WriteString(chunk)
	for {
		s := t.buf.String()
		if !t.inThink {
			if i := strings.Index(s, t.openTag); i >= 0 {
				if err := t.content(s[:i]); err != nil {
					return err
				}
				t.inThink = true
				t.buf.Reset()
				t.buf.WriteString(s[i+len(t.openTag):])
				continue
			}
			// Some templates omit the opening tag: a bare </think> means everything so far was reasoning.
			if j := strings.Index(s, t.closeTag); j >= 0 && !t.emittedText {
				if err := t.reasoning(s[:j]); err != nil {
					return err
				}
				t.buf.Reset()
				t.buf.WriteString(s[j+len(t.closeTag):])
				continue
			}
			keep := partialSuffix(s, t.openTag, t.closeTag)
			if err := t.content(s[:len(s)-keep]); err != nil {
				return err
			}
			t.buf.Reset()
			t.buf.WriteString(s[len(s)-keep:])
			return nil
		}
		if j := strings.Index(s, t.closeTag); j >= 0 {
			if err := t.reasoning(s[:j]); err != nil {
				return err
			}
			t.inThink = false
			t.buf.Reset()
			t.buf.WriteString(s[j+len(t.closeTag):])
			continue
		}
		keep := partialSuffix(s, t.closeTag)
		if err := t.reasoning(s[:len(s)-keep]); err != nil {
			return err
		}
		t.buf.Reset()
		t.buf.WriteString(s[len(s)-keep:])
		return nil
	}
}

// Flush emits whatever is buffered at end of stream.
func (t *thinkSplitter) Flush() error {
	s := t.buf.String()
	t.buf.Reset()
	if s == "" {
		return nil
	}
	if t.inThink {
		return t.reasoning(s)
	}
	return t.content(s)
}

func (t *thinkSplitter) content(s string) error {
	if s == "" {
		return nil
	}
	if !t.emittedText {
		// Drop leading whitespace emitted between tags and the first real token.
		s = strings.TrimLeft(s, " \t\r\n")
		if s == "" {
			return nil
		}
		t.emittedText = true
	}
	return t.onContent(s)
}

func (t *thinkSplitter) reasoning(s string) error {
	if s == "" {
		return nil
	}
	return t.onReasoning(s)
}

// partialSuffix returns the length of the longest suffix of s that is a strict prefix of any tag.
func partialSuffix(s string, tags ...string) int {
	best := 0
	for _, tag := range tags {
		for n := len(tag) - 1; n > 0; n-- {
			if n <= len(s) && strings.HasSuffix(s, tag[:n]) {
				if n > best {
					best = n
				}
				break
			}
		}
	}
	return best
}
