/**
 * Audio Stream Registry
 *
 * A global registry for managing MediaStream references used in audio edges.
 * This allows audio nodes to pass stream references between each other without
 * serializing audio data.
 */
class AudioStreamRegistry {
  private streams = new Map<string, MediaStream>();

  /**
   * Register a MediaStream and return a unique ID for reference.
   */
  register(stream: MediaStream): string {
    const id = crypto.randomUUID();
    this.streams.set(id, stream);
    return id;
  }

  /**
   * Get a MediaStream by its ID.
   */
  get(id: string): MediaStream | undefined {
    return this.streams.get(id);
  }

  /**
   * Unregister a stream and stop all its tracks.
   */
  unregister(id: string): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.streams.delete(id);
    }
  }

  /**
   * Clear all streams, stopping all tracks.
   */
  clear(): void {
    this.streams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.streams.clear();
  }

  /**
   * Check if a stream ID is registered.
   */
  has(id: string): boolean {
    return this.streams.has(id);
  }
}

export const audioRegistry = new AudioStreamRegistry();
