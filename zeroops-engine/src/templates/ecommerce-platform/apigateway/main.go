package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
	ImageEmoji  string  `json:"imageEmoji"`
}

type Recommendation struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	ImageEmoji string  `json:"imageEmoji"`
	Score      float64 `json:"score"`
}

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Database  string `json:"database"`
	Valkey    string `json:"valkey"`
	Timestamp string `json:"timestamp"`
}

var sampleProducts = []Product{
	{ID: "p1", Name: "Wireless Noise-Canceling Headphones", Description: "High fidelity audio with 30-hour battery life", Price: 199.99, Category: "Electronics", ImageEmoji: "🎧"},
	{ID: "p2", Name: "Smart Fitness Watch", Description: "Track metrics, heart rate, and GPS position", Price: 149.50, Category: "Wearables", ImageEmoji: "⌚"},
	{ID: "p3", Name: "Ergonomic Mesh Desk Chair", Description: "Lumbar support with fully adjustable headrest", Price: 289.00, Category: "Furniture", ImageEmoji: "🪑"},
	{ID: "p4", Name: "Mechanical RGB Keyboard", Description: "Hot-swappable tactile switches with PBT keycaps", Price: 119.95, Category: "Electronics", ImageEmoji: "⌨️"},
}

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

func productsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sampleProducts)
}

func recommendationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	aiWorkerURL := os.Getenv("AI_WORKER_URL")
	if aiWorkerURL == "" {
		aiWorkerURL = "http://aiworker:8000"
	}

	// Try querying Python recommendation engine
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(aiWorkerURL + "/recommend")
	if err == nil && resp.StatusCode == http.StatusOK {
		var recs []Recommendation
		if err := json.NewDecoder(resp.Body).Decode(&recs); err == nil && len(recs) > 0 {
			resp.Body.Close()
			json.NewEncoder(w).Encode(recs)
			return
		}
		resp.Body.Close()
	}

	// Fallback recommendations if AI worker is bootstrapping
	fallbackRecs := []Recommendation{
		{ID: "p2", Name: "Smart Fitness Watch", Price: 149.50, ImageEmoji: "⌚", Score: 0.95},
		{ID: "p4", Name: "Mechanical RGB Keyboard", Price: 119.95, ImageEmoji: "⌨️", Score: 0.89},
		{ID: "p1", Name: "Wireless Noise-Canceling Headphones", Price: 199.99, ImageEmoji: "🎧", Score: 0.84},
	}
	json.NewEncoder(w).Encode(fallbackRecs)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/products", productsHandler)
	http.HandleFunc("/api/recommendations", recommendationsHandler)

	log.Printf("[ecommerce-platform apigateway] Go REST API listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server exit: %v", err)
	}
}
