package cli

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"

	"berth/internal/websocket"

	ws "github.com/gorilla/websocket"
)

type Client struct {
	conn     *ws.Conn
	config   *Config
	mu       sync.Mutex
	handlers map[string]func([]byte)
}

func NewClient(config *Config) *Client {
	return &Client{
		config:   config,
		handlers: make(map[string]func([]byte)),
	}
}

func (c *Client) Connect() error {
	return c.ConnectToPath("/api/ws")
}

func (c *Client) ConnectToPath(path string) error {
	u, err := url.Parse(c.config.ServerURL)
	if err != nil {
		return fmt.Errorf("invalid server URL: %w", err)
	}

	if u.Scheme == "https" {
		u.Scheme = "wss"
	} else {
		u.Scheme = "ws"
	}
	u.Path = path

	headers := http.Header{}
	headers.Add("Authorization", "Bearer "+c.config.APIKey)

	dialer := ws.DefaultDialer
	if c.config.Insecure {
		dialer = &ws.Dialer{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	conn, _, err := dialer.Dial(u.String(), headers)
	if err != nil {
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}

	c.conn = conn
	go c.readMessages()
	return nil
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) readMessages() {
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var baseMsg websocket.BaseMessage
		if err := json.Unmarshal(message, &baseMsg); err == nil && baseMsg.Type != "" {
			c.mu.Lock()
			if handler, ok := c.handlers[string(baseMsg.Type)]; ok {
				go handler(message)
			}
			c.mu.Unlock()
		} else {
			c.mu.Lock()
			if handler, ok := c.handlers[""]; ok {
				go handler(message)
			}
			c.mu.Unlock()
		}
	}
}

func (c *Client) Send(msgType websocket.MessageType, payload interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	msg := map[string]interface{}{
		"type":    msgType,
		"payload": payload,
	}

	return c.conn.WriteJSON(msg)
}

func (c *Client) OnMessage(msgType websocket.MessageType, handler func([]byte)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[string(msgType)] = handler
}
