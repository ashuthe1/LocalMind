// services/ollama_service.go

package services

import (
	"bufio"
	"bytes"
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
	log.Println("Starting Ollama model execution.")
	cmd := exec.Command("ollama", "run", model)

	cmd.Stdin = bytes.NewBufferString(prompt)

	// Get output stream
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Println("Error getting stdout pipe:", err)
		return err
	}

	// Start command
	if err := cmd.Start(); err != nil {
		log.Println("Error starting Ollama command:", err)
		return err
	}

	reader := bufio.NewReader(stdout)
	for {
		chunk, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				log.Println("Reached end of Ollama output stream.")
				break
			}
			log.Println("Error reading from Ollama stdout:", err)
			return err
		}

		// Send the chunk
		if err := sendChunk(chunk); err != nil {
			log.Println("Error sending chunk:", err)
			return err
		}
	}

	// Wait for command completion
	err = cmd.Wait()
	if err != nil {
		log.Println("Ollama process exited with error:", err)
		return err
	}

	log.Println("Ollama response streaming complete.")
	return nil
}
