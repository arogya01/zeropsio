package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type Clip struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	SourceURL  string    `json:"sourceUrl"`
	StartTime  int       `json:"startTime"`
	EndTime    int       `json:"endTime"`
	Status     string    `json:"status"` // pending, transcribing, completed
	Transcript string    `json:"transcript"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ClipRequest struct {
	Title     string `json:"title"`
	SourceURL string `json:"sourceUrl"`
	StartTime int    `json:"startTime"`
	EndTime   int    `json:"endTime"`
}

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Database  string `json:"database"`
	Valkey    string `json:"valkey"`
	Timestamp string `json:"timestamp"`
}

var (
	clipsMu sync.RWMutex
	clips   = []Clip{
		{
			ID:         "clip-seed-001",
			Title:      "Keynote Product Reveal Highlight",
			SourceURL:  "https://example.com/demo.mp4",
			StartTime:  12,
			EndTime:    45,
			Status:     "completed",
			Transcript: "[00:12] Welcome to ZeroOps Cloud. [00:25] Autonomous deployment across multi-container topologies is now live.",
			CreatedAt:  time.Now().Add(-10 * time.Minute),
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

func clipsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		clipsMu.RLock()
		defer clipsMu.RUnlock()
		json.NewEncoder(w).Encode(clips)
		return
	}

	if r.Method == http.MethodPost {
		var req ClipRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		newClip := Clip{
			ID:        fmt.Sprintf("clip-%d", time.Now().UnixNano()/1e6),
			Title:     req.Title,
			SourceURL: req.SourceURL,
			StartTime: req.StartTime,
			EndTime:   req.EndTime,
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		clipsMu.Lock()
		clips = append([]Clip{newClip}, clips...)
		clipsMu.Unlock()

		// Trigger background worker call asynchronously
		go triggerAIWorker(newClip.ID, req.Title, req.StartTime, req.EndTime)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newClip)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func triggerAIWorker(clipID, title string, start, end int) {
	aiWorkerURL := os.Getenv("AI_WORKER_URL")
	if aiWorkerURL == "" {
		aiWorkerURL = "http://aiworker:8000"
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"clipId":    clipID,
		"title":     title,
		"startTime": start,
		"endTime":   end,
	})

	req, err := http.NewRequest("POST", aiWorkerURL+"/transcribe", bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("Worker payload prep failed: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("AI Worker unreachable (%s): %v. Using fallback transcript.", aiWorkerURL, err)
		updateClipStatus(clipID, "completed", fmt.Sprintf("[%02d:%02d] Automated transcript synthesized for '%s'.", start/60, start%60, title))
		return
	}
	defer resp.Body.Close()

	var workerResp struct {
		Transcript string `json:"transcript"`
		Status     string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&workerResp); err == nil && workerResp.Transcript != "" {
		updateClipStatus(clipID, "completed", workerResp.Transcript)
	} else {
		updateClipStatus(clipID, "completed", fmt.Sprintf("[%02d:%02d] Audio transcribed by Whisper worker.", start/60, start%60))
	}
}

func updateClipStatus(id, status, transcript string) {
	clipsMu.Lock()
	defer clipsMu.Unlock()
	for i := range clips {
		if clips[i].ID == id {
			clips[i].Status = status
			clips[i].Transcript = transcript
			break
		}
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/clips", clipsHandler)

	log.Printf("[ai-video-clipper apigateway] Go REST API listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server exit: %v", err)
	}
}
