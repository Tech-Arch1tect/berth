package agentsign

import (
	"crypto/ecdsa"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"sync"
)

const (
	StreamContext = "berth-stream-v1"

	DirectionToAgent = "to-agent"
	DirectionToBerth = "to-berth"

	sequenceBytes = 8
	macBytes      = 32
	frameOverhead = sequenceBytes + macBytes
)

var ErrFrameRejected = errors.New("stream frame rejected")

func SessionKey(local *ecdsa.PrivateKey, remote *ecdsa.PublicKey, salt string) ([]byte, error) {
	localECDH, err := local.ECDH()
	if err != nil {
		return nil, err
	}
	remoteECDH, err := remote.ECDH()
	if err != nil {
		return nil, err
	}
	shared, err := localECDH.ECDH(remoteECDH)
	if err != nil {
		return nil, err
	}
	return expand(shared, salt), nil
}

func expand(shared []byte, salt string) []byte {
	extract := hmac.New(sha256.New, []byte(salt))
	extract.Write(shared)
	pseudorandom := extract.Sum(nil)

	expandKey := hmac.New(sha256.New, pseudorandom)
	expandKey.Write([]byte(StreamContext))
	expandKey.Write([]byte{1})
	return expandKey.Sum(nil)
}

type FrameWriter struct {
	key       []byte
	direction string
	mutex     sync.Mutex
	sequence  uint64
}

func NewFrameWriter(key []byte, direction string) *FrameWriter {
	return &FrameWriter{key: key, direction: direction}
}

func (w *FrameWriter) Wrap(payload []byte) []byte {
	w.mutex.Lock()
	sequence := w.sequence
	w.sequence++
	w.mutex.Unlock()

	frame := make([]byte, frameOverhead+len(payload))
	binary.BigEndian.PutUint64(frame[:sequenceBytes], sequence)
	copy(frame[frameOverhead:], payload)
	copy(frame[sequenceBytes:frameOverhead], frameMAC(w.key, w.direction, sequence, payload))
	return frame
}

type FrameReader struct {
	key       []byte
	direction string
	mutex     sync.Mutex
	expected  uint64
}

func NewFrameReader(key []byte, direction string) *FrameReader {
	return &FrameReader{key: key, direction: direction}
}

func (r *FrameReader) Unwrap(frame []byte) ([]byte, error) {
	if len(frame) < frameOverhead {
		return nil, ErrFrameRejected
	}

	sequence := binary.BigEndian.Uint64(frame[:sequenceBytes])
	payload := frame[frameOverhead:]

	if !hmac.Equal(frame[sequenceBytes:frameOverhead], frameMAC(r.key, r.direction, sequence, payload)) {
		return nil, ErrFrameRejected
	}

	r.mutex.Lock()
	defer r.mutex.Unlock()
	if sequence != r.expected {
		return nil, ErrFrameRejected
	}
	r.expected++

	return payload, nil
}

func (w *FrameWriter) WrapTyped(kind byte, payload []byte) []byte {
	return w.Wrap(append([]byte{kind}, payload...))
}

func (r *FrameReader) UnwrapTyped(frame []byte) (byte, []byte, error) {
	payload, err := r.Unwrap(frame)
	if err != nil {
		return 0, nil, err
	}
	if len(payload) == 0 {
		return 0, nil, ErrFrameRejected
	}
	return payload[0], payload[1:], nil
}

func frameMAC(key []byte, direction string, sequence uint64, payload []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(direction))
	var counter [sequenceBytes]byte
	binary.BigEndian.PutUint64(counter[:], sequence)
	mac.Write(counter[:])
	mac.Write(payload)
	return mac.Sum(nil)
}
