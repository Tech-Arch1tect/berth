package harness

import "sync"

type SentMail struct {
	Template string
	To       []string
	Subject  string
	Data     map[string]any
}

type CapturingMailService struct {
	mu   sync.Mutex
	sent []SentMail
}

func NewCapturingMailService() *CapturingMailService {
	return &CapturingMailService{}
}

func (c *CapturingMailService) SendTemplate(templateName string, to []string, subject string, data map[string]any) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	toCopy := append([]string(nil), to...)
	dataCopy := make(map[string]any, len(data))
	for k, v := range data {
		dataCopy[k] = v
	}

	c.sent = append(c.sent, SentMail{
		Template: templateName,
		To:       toCopy,
		Subject:  subject,
		Data:     dataCopy,
	})
	return nil
}

func (c *CapturingMailService) Sent() []SentMail {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]SentMail, len(c.sent))
	copy(out, c.sent)
	return out
}

func (c *CapturingMailService) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.sent)
}

func (c *CapturingMailService) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sent = nil
}

func (c *CapturingMailService) ByTemplate(name string) []SentMail {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []SentMail
	for _, m := range c.sent {
		if m.Template == name {
			out = append(out, m)
		}
	}
	return out
}

func (c *CapturingMailService) Last() *SentMail {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.sent) == 0 {
		return nil
	}
	m := c.sent[len(c.sent)-1]
	return &m
}
