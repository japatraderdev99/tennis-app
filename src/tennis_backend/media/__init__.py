"""Read-only local media inspection; timestamps are original PTS, never FPS."""

from ._inspect import MediaError, MediaLimits, inspect_media

__all__ = ["MediaError", "MediaLimits", "inspect_media"]
