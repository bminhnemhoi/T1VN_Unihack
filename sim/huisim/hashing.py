"""Keccak-256 and the bid commit hash, in pure Python (no extra dependency).

``hashlib.sha3_256`` is NIST SHA-3 (padding 0x06), not the original Keccak
(padding 0x01) that Ethereum uses, so the permutation is implemented here.
It only serves the differential vectors; the product never hashes in Python.
"""

from __future__ import annotations

_MASK = (1 << 64) - 1

_ROUND_CONSTANTS: tuple[int, ...] = (
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
)  # fmt: skip

# Rotation offsets indexed [x][y].
_ROTATIONS: tuple[tuple[int, ...], ...] = (
    (0, 36, 3, 41, 18),
    (1, 44, 10, 45, 2),
    (62, 6, 43, 15, 61),
    (28, 55, 25, 21, 56),
    (27, 20, 39, 8, 14),
)

_RATE_BYTES = 136  # 1088-bit rate for a 256-bit output


def _rol(value: int, shift: int) -> int:
    shift %= 64
    return ((value << shift) | (value >> (64 - shift))) & _MASK if shift else value


def _keccak_f(a: list[int]) -> None:
    """Keccak-f[1600] on a 5x5 lane state stored as ``a[x + 5 * y]``."""
    for rc in _ROUND_CONSTANTS:
        c = [a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        for i in range(25):
            a[i] ^= d[i % 5]
        b = [0] * 25
        for x in range(5):
            for y in range(5):
                b[y + 5 * ((2 * x + 3 * y) % 5)] = _rol(a[x + 5 * y], _ROTATIONS[x][y])
        for y in range(5):
            for x in range(5):
                a[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & b[(x + 2) % 5 + 5 * y])
        a[0] ^= rc
        a[:] = [lane & _MASK for lane in a]


def _sponge(data: bytes, pad: int) -> bytes:
    """Keccak sponge with a 256-bit output; ``pad`` is 0x01 (Keccak) or 0x06 (SHA-3)."""
    padded = bytearray(data)
    padded.append(pad)
    while len(padded) % _RATE_BYTES:
        padded.append(0x00)
    padded[-1] |= 0x80
    state = [0] * 25
    for off in range(0, len(padded), _RATE_BYTES):
        block = padded[off : off + _RATE_BYTES]
        for i in range(_RATE_BYTES // 8):
            state[i] ^= int.from_bytes(block[8 * i : 8 * i + 8], "little")
        _keccak_f(state)
    return b"".join(lane.to_bytes(8, "little") for lane in state[:4])


def keccak256(data: bytes) -> bytes:
    """Ethereum Keccak-256 of ``data``."""
    return _sponge(data, 0x01)


def _address_word(address: str) -> bytes:
    raw = bytes.fromhex(address.removeprefix("0x"))
    if len(raw) != 20:
        raise ValueError(f"address must be 20 bytes: {address}")
    return raw.rjust(32, b"\x00")


def _uint_word(value: int, bits: int) -> bytes:
    if not 0 <= value < 1 << bits:
        raise OverflowError(f"{value} does not fit in uint{bits}")
    return value.to_bytes(32, "big")


def commit_hash(circle: str, round_: int, member: str, bid: int, salt: str) -> str:
    """keccak256(abi.encode(circle, round, member, bid, salt)) as lowercase 0x hex.

    Types: address circle, uint32 round, address member, uint256 bid, bytes32 salt.

    See docs/03 section 6.2 and docs/05 section 5.4.
    """
    salt_raw = bytes.fromhex(salt.removeprefix("0x"))
    if len(salt_raw) != 32:
        raise ValueError("salt must be 32 bytes")
    encoded = (
        _address_word(circle)
        + _uint_word(round_, 32)
        + _address_word(member)
        + _uint_word(bid, 256)
        + salt_raw
    )
    return "0x" + keccak256(encoded).hex()
