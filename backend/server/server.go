package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"sezzle/backend/calc"
)

const (
	maxRequestBytes         = 1 << 20
	invalidRequestMessage   = "invalid request"
	methodNotAllowedMessage = "method not allowed"
)

type calculateRequest struct {
	Operation string  `json:"operation"`
	A         float64 `json:"a"`
	B         float64 `json:"b"`
}

type resultResponse struct {
	Result float64 `json:"result"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func NewHandler() http.Handler {
	return NewHandlerWithStatic(nil)
}

func NewHandlerWithStatic(static http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/calculate", handleCalculate)
	mux.HandleFunc("/health", handleHealth)
	if static != nil {
		mux.Handle("/", static)
	}
	return withCORS(mux)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, methodNotAllowedMessage)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, methodNotAllowedMessage)
		return
	}

	body := http.MaxBytesReader(w, r.Body, maxRequestBytes)
	defer body.Close()

	req, err := decodeCalculateRequest(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, invalidRequestMessage)
		return
	}

	result, err := calc.Calculate(req.Operation, req.A, req.B)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resultResponse{Result: result})
}

func decodeCalculateRequest(body io.Reader) (calculateRequest, error) {
	dec := json.NewDecoder(body)
	var raw map[string]json.RawMessage
	if err := dec.Decode(&raw); err != nil {
		return calculateRequest{}, err
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return calculateRequest{}, errors.New("trailing json")
	}

	operation, okOp := raw["operation"]
	aRaw, okA := raw["a"]
	bRaw, okB := raw["b"]
	if !okOp || !okA || !okB || len(raw) != 3 {
		return calculateRequest{}, errors.New("unexpected fields")
	}

	op, err := parseJSONString(operation)
	if err != nil {
		return calculateRequest{}, err
	}
	a, err := parseJSONFloat(aRaw)
	if err != nil {
		return calculateRequest{}, err
	}
	b, err := parseJSONFloat(bRaw)
	if err != nil {
		return calculateRequest{}, err
	}
	return calculateRequest{Operation: op, A: a, B: b}, nil
}

func parseJSONString(raw json.RawMessage) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '"' {
		return "", errors.New("not a string")
	}
	var value string
	if err := json.Unmarshal(trimmed, &value); err != nil {
		return "", err
	}
	return value, nil
}

func parseJSONFloat(raw json.RawMessage) (float64, error) {
	trimmed := bytes.TrimSpace(raw)
	if !isJSONNumber(trimmed) {
		return 0, errors.New("not a number")
	}
	var value float64
	if err := json.Unmarshal(trimmed, &value); err != nil {
		return 0, err
	}
	return value, nil
}

func isJSONNumber(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	switch raw[0] {
	case '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		return true
	default:
		return false
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, calc.ErrDivisionByZero):
		writeError(w, http.StatusBadRequest, calc.ErrDivisionByZero.Error())
	case errors.Is(err, calc.ErrNegativeSqrt):
		writeError(w, http.StatusBadRequest, calc.ErrNegativeSqrt.Error())
	case errors.Is(err, calc.ErrNonFinite):
		writeError(w, http.StatusBadRequest, calc.ErrNonFinite.Error())
	case errors.Is(err, calc.ErrUnknownOp):
		writeError(w, http.StatusBadRequest, calc.ErrUnknownOp.Error())
	default:
		writeError(w, http.StatusBadRequest, invalidRequestMessage)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
