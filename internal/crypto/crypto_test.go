package crypto

import (
	"encoding/base64"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	c := NewCrypto("test-secret-key")

	tests := []string{
		"hello world",
		"",
		"a",
		"special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
		"unicode: 日本語テスト 🚀",
		string(make([]byte, 4096)),
	}

	for _, input := range tests {
		encrypted, err := c.Encrypt(input)
		if err != nil {
			t.Fatalf("Encrypt(%q) failed: %v", input, err)
		}

		decrypted, err := c.Decrypt(encrypted)
		if err != nil {
			t.Fatalf("Decrypt() failed for input %q: %v", input, err)
		}

		if decrypted != input {
			t.Errorf("round-trip failed: got %q, want %q", decrypted, input)
		}
	}
}

func TestEmptyString(t *testing.T) {
	c := NewCrypto("test-secret-key")

	encrypted, err := c.Encrypt("")
	if err != nil {
		t.Fatalf("Encrypt empty string failed: %v", err)
	}
	if encrypted != "" {
		t.Errorf("Encrypt empty string should return empty, got %q", encrypted)
	}

	decrypted, err := c.Decrypt("")
	if err != nil {
		t.Fatalf("Decrypt empty string failed: %v", err)
	}
	if decrypted != "" {
		t.Errorf("Decrypt empty string should return empty, got %q", decrypted)
	}
}

func TestNonceRandomness(t *testing.T) {
	c := NewCrypto("test-secret-key")
	plaintext := "same input"

	enc1, err := c.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("first Encrypt failed: %v", err)
	}

	enc2, err := c.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("second Encrypt failed: %v", err)
	}

	if enc1 == enc2 {
		t.Error("two encryptions of same plaintext should produce different ciphertexts")
	}

	dec1, _ := c.Decrypt(enc1)
	dec2, _ := c.Decrypt(enc2)
	if dec1 != plaintext || dec2 != plaintext {
		t.Error("both ciphertexts should decrypt to the same plaintext")
	}
}

func TestInvalidBase64(t *testing.T) {
	c := NewCrypto("test-secret-key")
	_, err := c.Decrypt("not-valid-base64!!!")
	if err == nil {
		t.Error("Decrypt with invalid base64 should return error")
	}
}

func TestCiphertextTooShort(t *testing.T) {
	c := NewCrypto("test-secret-key")
	short := base64.StdEncoding.EncodeToString([]byte("tiny"))
	_, err := c.Decrypt(short)
	if err == nil {
		t.Error("Decrypt with too-short ciphertext should return error")
	}
}

func TestWrongKey(t *testing.T) {
	c1 := NewCrypto("key-one")
	c2 := NewCrypto("key-two")

	encrypted, err := c1.Encrypt("secret data")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	_, err = c2.Decrypt(encrypted)
	if err == nil {
		t.Error("Decrypt with wrong key should return error")
	}
}

func TestTamperedCiphertext(t *testing.T) {
	c := NewCrypto("test-secret-key")

	encrypted, err := c.Encrypt("secret data")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	data, _ := base64.StdEncoding.DecodeString(encrypted)
	data[len(data)-1] ^= 0xff
	tampered := base64.StdEncoding.EncodeToString(data)

	_, err = c.Decrypt(tampered)
	if err == nil {
		t.Error("Decrypt with tampered ciphertext should return error")
	}
}
