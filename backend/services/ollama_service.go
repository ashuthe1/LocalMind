// services/ollama_service.go

package services

import (
	"bufio"
	"bytes"
	"io"
	"os/exec"
)

type OllamaService struct{}

func NewOllamaService() *OllamaService {
	return &OllamaService{}
}

// GenerateResponse remains for non-streaming use if needed.
func (s *OllamaService) GenerateResponse(prompt string, model string) (string, error) {
	// Prepare the command
	cmd := exec.Command("ollama", "run", model)

	// Provide the prompt as stdin input
	cmd.Stdin = bytes.NewBufferString(prompt)

	// Capture the output
	var out bytes.Buffer
	cmd.Stdout = &out

	// Run the command
	if err := cmd.Run(); err != nil {
		return "", err
	}

	// Get the response
	response := out.String()
	return response, nil
}

// StreamResponse streams the response from the Ollama model by reading its stdout in chunks.
// The sendChunk callback is used to send each chunk (e.g., via SSE).
func (s *OllamaService) StreamResponse(prompt string, model string, sendChunk func(chunk string) error) error {
	// Prepare the command
	cmd := exec.Command("ollama", "run", model)

	// Provide the prompt as stdin input
	cmd.Stdin = bytes.NewBufferString(prompt)

	// Get a pipe to read the stdout data
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		return err
	}

	// Create a reader for the stdout
	reader := bufio.NewReader(stdout)
	for {
		// Read output until newline (or a timeout/partial chunk if needed)
		chunk, err := reader.ReadString('\n')
		if err != nil {
			// If we reached the end of output, break out of the loop.
			if err == io.EOF {
				break
			}
			return err
		}

		// Send the chunk using the callback.
		if err := sendChunk(chunk); err != nil {
			return err
		}
	}

	// Wait for the command to exit.
	return cmd.Wait()
}
