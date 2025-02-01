// services/ollama_service.go

package services

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"log"
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

func (s *OllamaService) StreamResponse(prompt string, model string, sendChunk func(chunk string) error) error {
	log.Println("Starting Ollama streaming process...")

	cmd := exec.Command("ollama", "run", model)
	cmd.Stdin = bytes.NewBufferString(prompt)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Println("Error getting stdout pipe:", err)
		return err
	}

	if err := cmd.Start(); err != nil {
		log.Println("Error starting Ollama process:", err)
		return err
	}

	defer cmd.Wait() // Ensure process cleanup

	reader := bufio.NewReader(stdout)
	for {
		chunk, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				log.Println("End of Ollama output stream")
				break
			}
			log.Println("Error reading from Ollama stream:", err)
			return err
		}

		if err := sendChunk(chunk); err != nil {
			log.Println("Error in sendChunk:", err)
			return fmt.Errorf("failed to send chunk: %w", err)
		}
	}

	log.Println("Ollama streaming completed successfully")
	return nil
}
