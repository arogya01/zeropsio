package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type SearchRequest struct {
	Query string `json:"query"`
}

type DocumentChunk struct {
	ID      string  `json:"id"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Score   float64 `json:"score"`
}

type SearchResponse struct {
	Query     string          `json:"query"`
	Answer    string          `json:"answer"`
	Documents []DocumentChunk `json:"documents"`
}

type IngestRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Database  string `json:"database"`
	Valkey    string `json:"valkey"`
	Timestamp string `json:"timestamp"`
}

var (
	docsMu sync.RWMutex
	docs   = []DocumentChunk{
		{
			ID:      "doc-1",
			Title:   "Zerops Cloud Platform Documentation",
			Snippet: "Zerops is a developer-first PaaS platform supporting automatic scaling, multi-container private networks, and managed PostgreSQL & Valkey databases.",
			Score:   0.94,
		},
		{
			ID:      "doc-2",
			Title:   "ZeroOps Autonomous Engine Overview",
			Snippet: "ZeroOps Engine transforms natural language application prompts into spec-compliant Zerops stack topologies and deploys them autonomously.",
			Score:   0.88,
		},
	}
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	dbHost := os.Getenv("DB_HOST")
	valkeyHost := os.Getenv("VALKEY_HOST")

	dbStatus := "disconnected"
	if dbHost != "" {
		dbStatus = fmt.Sprintf("configured (%s)", dbHost)
	}
	valkeyStatus := "disconnected"
	if valkeyHost != "" {
		valkeyStatus = fmt.Sprintf("configured (%s)", valkeyHost)
	}

	json.NewEncoder(w).Encode(HealthResponse{
		Status:    "ok",
		Service:   "apigateway-go",
		Database:  dbStatus,
		Valkey:    valkeyStatus,
		Timestamp: time.Now().Format(time.RFC3339),
	})
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Query) == "" {
		http.Error(w, "Query is required", http.StatusBadRequest)
		return
	}

	docsMu.RLock()
	retrieved := docs
	docsMu.RUnlock()

	answer := fmt.Sprintf("Based on indexed knowledge chunks for '%s': Zerops provides high-performance PaaS orchestration with direct container-to-container private networking and instant scaling.", req.Query)

	resp := SearchResponse{
		Query:     req.Query,
		Answer:    answer,
		Documents: retrieved,
	}

	json.NewEncoder(w).Encode(resp)
}

func documentsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet {
		docsMu.RLock()
		defer docsMu.RUnlock()
		json.NewEncoder(w).Encode(docs)
		return
	}

	if r.Method == http.MethodPost {
		var req IngestRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Forward document to Python aiworker for vector embedding generation
		aiWorkerURL := os.Getenv("AI_WORKER_URL")
		if aiWorkerURL == "" {
			aiWorkerURL = "http://aiworker:8000"
		}

		payload, _ := json.Marshal(req)
		client := &http.Client{Timeout: 5 * time.Second}
		_, _ = client.Post(aiWorkerURL+"/embed", "application/json", bytes.NewBuffer(payload))

		newDoc := DocumentChunk{
			ID:      fmt.Sprintf("doc-%d", time.Now().Unix()),
			Title:   req.Title,
			Snippet: req.Content,
			Score:   0.98,
		}

		docsMu.Lock()
		docs = append([]DocumentChunk{newDoc}, docs...)
		docsMu.Unlock()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newDoc)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/search", searchHandler)
	http.HandleFunc("/api/documents", documentsHandler)

	log.Printf("[rag-search-engine apigateway] Go REST API listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server exit: %v", err)
	}
}
