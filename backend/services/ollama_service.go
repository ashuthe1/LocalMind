// services/ollama_service.go

package services

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os/exec"

	"github.com/ashuthe1/localmind/logger"
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

func (s *OllamaService) StreamResponse(prompt string, model string, sendChunk func(chunk string) error) error {
	// log.Println("Starting Ollama streaming process...")

	cmd := exec.Command("ollama", "run", model)
	cmd.Stdin = bytes.NewBufferString(prompt)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		logger.Log.Errorf("Error getting stdout pipe: %v", err)
		return err
	}

	if err := cmd.Start(); err != nil {
		logger.Log.Errorf("Error starting Ollama process: %v", err)
		return err
	}

	defer cmd.Wait() // Ensure process cleanup

	reader := bufio.NewReader(stdout)
	for {
		chunk, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				// log.Println("End of Ollama output stream")
				break
			}
			logger.Log.Errorf("Error reading from Ollama stream: %v", err)
			return err
		}

		if err := sendChunk(chunk); err != nil {
			logger.Log.Errorf("Error in sendChunk: %v", err)
			return fmt.Errorf("failed to send chunk: %w", err)
		}
	}

	return nil
}
