package mail

import (
	"bytes"
	"fmt"
	htmlTemplate "html/template"
	"os"
	"path/filepath"
	textTemplate "text/template"

	"berth/internal/pkg/config"
	"github.com/wneessen/go-mail"
	"go.uber.org/zap"
)

type Client struct {
	cfg       *config.MailConfig
	smtp      *mail.Client
	htmlTmpls *htmlTemplate.Template
	textTmpls *textTemplate.Template
	logger    *zap.Logger
}

func NewClient(cfg *config.Config, logger *zap.Logger) (*Client, error) {
	mc := &cfg.Mail
	if mc.FromAddress == "" {
		return nil, fmt.Errorf("MAIL_FROM_ADDRESS is required")
	}

	opts := []mail.Option{mail.WithPort(mc.Port)}
	switch mc.Encryption {
	case "ssl":
		opts = append(opts, mail.WithSSL())
	case "none":
		opts = append(opts, mail.WithTLSPortPolicy(mail.NoTLS))
	default:
		opts = append(opts, mail.WithTLSPortPolicy(mail.TLSMandatory))
	}
	if mc.Username != "" {
		opts = append(opts, mail.WithSMTPAuth(mail.SMTPAuthPlain), mail.WithUsername(mc.Username))
	}
	if mc.Password != "" {
		opts = append(opts, mail.WithPassword(mc.Password))
	}

	smtp, err := mail.NewClient(mc.Host, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create mail client: %w", err)
	}

	c := &Client{cfg: mc, smtp: smtp, logger: logger}
	if err := c.loadTemplates(); err != nil {
		return nil, fmt.Errorf("failed to load mail templates: %w", err)
	}
	return c, nil
}

func (c *Client) loadTemplates() error {
	if c.cfg.TemplatesDir == "" {
		return nil
	}
	if _, err := os.Stat(c.cfg.TemplatesDir); os.IsNotExist(err) {
		return nil
	}

	htmlPattern := filepath.Join(c.cfg.TemplatesDir, "*.html")
	textPattern := filepath.Join(c.cfg.TemplatesDir, "*.txt")

	htmlFiles, err := filepath.Glob(htmlPattern)
	if err != nil {
		return fmt.Errorf("glob html: %w", err)
	}
	if len(htmlFiles) > 0 {
		c.htmlTmpls, err = htmlTemplate.ParseGlob(htmlPattern)
		if err != nil {
			return fmt.Errorf("parse html templates: %w", err)
		}
	}

	textFiles, err := filepath.Glob(textPattern)
	if err != nil {
		return fmt.Errorf("glob text: %w", err)
	}
	if len(textFiles) > 0 {
		c.textTmpls, err = textTemplate.ParseGlob(textPattern)
		if err != nil {
			return fmt.Errorf("parse text templates: %w", err)
		}
	}
	return nil
}

func (c *Client) SendTemplate(templateName string, to []string, subject string, data map[string]any) error {
	msg := mail.NewMsg()

	fromAddr := c.cfg.FromAddress
	if c.cfg.FromName != "" {
		fromAddr = fmt.Sprintf("%s <%s>", c.cfg.FromName, c.cfg.FromAddress)
	}
	if err := msg.From(fromAddr); err != nil {
		return fmt.Errorf("set FROM: %w", err)
	}
	if err := msg.To(to...); err != nil {
		return fmt.Errorf("set TO: %w", err)
	}
	msg.Subject(subject)

	if err := c.renderTemplate(templateName, data, msg); err != nil {
		return err
	}

	if err := c.smtp.DialAndSend(msg); err != nil {
		c.logger.Error("failed to send email", zap.Error(err), zap.String("template", templateName))
		return err
	}
	c.logger.Info("email sent", zap.String("template", templateName), zap.Strings("to", to))
	return nil
}

func (c *Client) renderTemplate(name string, data map[string]any, msg *mail.Msg) error {
	var rendered bool

	if c.htmlTmpls != nil {
		if t := c.htmlTmpls.Lookup(name + ".html"); t != nil {
			var buf bytes.Buffer
			if err := t.Execute(&buf, data); err != nil {
				return fmt.Errorf("execute html template %q: %w", name, err)
			}
			msg.SetBodyString(mail.TypeTextHTML, buf.String())
			rendered = true
		}
	}

	if c.textTmpls != nil {
		if t := c.textTmpls.Lookup(name + ".txt"); t != nil {
			var buf bytes.Buffer
			if err := t.Execute(&buf, data); err != nil {
				return fmt.Errorf("execute text template %q: %w", name, err)
			}
			if rendered {
				msg.AddAlternativeString(mail.TypeTextPlain, buf.String())
			} else {
				msg.SetBodyString(mail.TypeTextPlain, buf.String())
			}
			rendered = true
		}
	}

	if !rendered {
		return fmt.Errorf("template %q not found", name)
	}
	return nil
}
