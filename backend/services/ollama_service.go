// services/ollama_service.go

package services

import (
	"bytes"
	"os/exec"
)

type OllamaService struct{}

func NewOllamaService() *OllamaService {
	return &OllamaService{}
}

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
