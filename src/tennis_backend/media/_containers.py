"""Conservative container gates before any native decoder is invoked.

These are reference checks, not general media validators or a security sandbox.
Reads use pread so the caller's read-only descriptor offset is unchanged.
"""

import os
import struct
from collections.abc import Callable

from ._errors import MediaError


def _invalid() -> None:
    raise MediaError("invalid_media", "The container structure is invalid or incomplete.")


def _external() -> None:
    raise MediaError("external_reference", "External media references are unsupported.")


def container_format(fd: int, size: int, check_time: Callable[[], None]) -> str:
    header = os.pread(fd, 12, 0)
    if header.startswith(b"RIFF") and header[8:12] == b"AVI ":
        return "avi"
    if header.startswith(b"\x1aE\xdf\xa3"):
        _check_ebml(fd, size, check_time)
        return "matroska"
    # Require a recognizable first MOV/MP4 atom; never let FFprobe auto-detect
    # a playlist, image sequence, or another indirect format from file contents.
    if header[4:8] in {b"ftyp", b"moov", b"mdat", b"free", b"wide", b"skip"}:
        _check_mov(fd, size, check_time)
        return "mov"
    raise MediaError("unsupported_container", "Only self-contained MOV, MP4, Matroska and AVI are supported.")


def _check_mov(fd: int, size: int, check_time: Callable[[], None]) -> None:
    count = 0
    containers = {b"moov", b"trak", b"mdia", b"minf", b"dinf", b"stbl", b"edts",
                  b"udta", b"moof", b"traf", b"mvex", b"mfra", b"wave"}

    def boxes(start: int, end: int, depth: int = 0) -> None:
        nonlocal count
        if depth > 12:
            _invalid()
        pos = start
        while pos < end:
            check_time()
            count += 1
            if count > 100_000:
                raise MediaError("container_limit", "The container has too many structural elements.")
            raw = os.pread(fd, 16, pos)
            if len(raw) < 8 or end - pos < 8:
                _invalid()
            length, kind = struct.unpack(">I4s", raw[:8])
            head = 8
            if length == 1:
                if len(raw) < 16:
                    _invalid()
                length = int.from_bytes(raw[8:16], "big")
                head = 16
            elif length == 0:
                length = end - pos
            if length < head or pos + length > end:
                _invalid()
            body, stop = pos + head, pos + length
            if kind in {b"rmra", b"rmda", b"rdrf", b"alis"}:
                _external()
            if kind == b"cmov":
                raise MediaError("unsupported_container", "Compressed movie headers are unsupported.")
            if kind in containers:
                boxes(body, stop, depth + 1)
            elif kind == b"dref":
                data = os.pread(fd, 8, body)
                if len(data) != 8 or stop - body < 8:
                    _invalid()
                entries = int.from_bytes(data[4:], "big")
                cursor = body + 8
                if entries > 100_000:
                    _invalid()
                for _ in range(entries):
                    check_time()
                    entry = os.pread(fd, 12, cursor)
                    if len(entry) != 12 or cursor + 12 > stop:
                        _invalid()
                    entry_size, entry_kind = struct.unpack(">I4s", entry[:8])
                    flags = int.from_bytes(entry[9:12], "big")
                    if entry_size < 12 or cursor + entry_size > stop:
                        _invalid()
                    # QuickTime also uses an empty 'alis' entry for this file.
                    # Accept only version 0, self-reference flag 1, no payload.
                    # External aliases/URLs, URNs and unknown versions stay closed.
                    if (entry_kind not in {b"url ", b"alis"} or entry[8] != 0
                            or flags != 1 or entry_size != 12):
                        _external()
                    cursor += entry_size
                if cursor != stop:
                    _invalid()
            pos = stop

    boxes(0, size)


def _check_ebml(fd: int, size: int, check_time: Callable[[], None]) -> None:
    # The hierarchy containing inter-segment links; payload/cluster blocks are
    # skipped by their declared sizes, never searched as arbitrary byte strings.
    masters = {0x1A45DFA3, 0x18538067, 0x1549A966, 0x1043A770, 0x45B9, 0xB6}
    references = {0x3CB923, 0x3EB923, 0x3C83AB, 0x3E83BB, 0x4444, 0x6E67, 0x6EBC}
    count = 0

    def vint(pos: int, *, identifier: bool) -> tuple[int, int, bool]:
        raw = os.pread(fd, 8, pos)
        if not raw or raw[0] == 0:
            _invalid()
        width = 9 - raw[0].bit_length()
        if width > (4 if identifier else 8) or len(raw) < width:
            _invalid()
        value = int.from_bytes(raw[:width], "big")
        if not identifier:
            value &= (1 << (7 * width)) - 1
        unknown = not identifier and value == (1 << (7 * width)) - 1
        return value, width, unknown

    def elements(start: int, end: int, depth: int = 0) -> None:
        nonlocal count
        if depth > 12:
            _invalid()
        pos = start
        while pos < end:
            check_time()
            count += 1
            if count > 100_000:
                raise MediaError("container_limit", "The container has too many structural elements.")
            kind, width, _ = vint(pos, identifier=True)
            length, size_width, unknown = vint(pos + width, identifier=False)
            body = pos + width + size_width
            if kind in references:
                _external()
            if unknown and kind != 0x18538067:
                raise MediaError("unsupported_container", "Unknown-size EBML elements other than Segment are unsupported.")
            stop = end if unknown else body + length
            if body > end or stop > end:
                _invalid()
            if kind in masters:
                elements(body, stop, depth + 1)
            pos = stop

    elements(0, size)
