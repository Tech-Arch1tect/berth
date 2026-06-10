package operations

import (
	"fmt"
	"strings"
)

type StreamReader struct {
	lines chan string
	done  chan struct{}
}

func (sr *StreamReader) Lines() <-chan string {
	return sr.lines
}

func (sr *StreamReader) Close() {
	close(sr.done)
	close(sr.lines)
}

func streamPipe() (*StreamReader, *StreamWriter) {
	lines := make(chan string, 100)
	done := make(chan struct{})

	reader := &StreamReader{lines: lines, done: done}
	writer := &StreamWriter{lines: lines, done: done}

	return reader, writer
}

type StreamWriter struct {
	lines chan string
	done  chan struct{}
}

func (sw *StreamWriter) Write(p []byte) (n int, err error) {
	select {
	case <-sw.done:
		return 0, fmt.Errorf("stream closed")
	default:
	}

	data := string(p)
	lines := strings.SplitSeq(data, "\n")

	for line := range lines {
		if line != "" {
			select {
			case sw.lines <- line:
			case <-sw.done:
				return len(p), nil
			default:

			}
		}
	}

	return len(p), nil
}

func (sw *StreamWriter) Close() error {
	close(sw.done)
	return nil
}
