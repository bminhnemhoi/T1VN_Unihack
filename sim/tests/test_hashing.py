import hashlib

import pytest

from huisim.hashing import _sponge, commit_hash, keccak256


def test_keccak256_known_vectors() -> None:
    assert keccak256(b"").hex() == (
        "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    )
    assert keccak256(b"abc").hex() == (
        "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    )
    # ERC-20 transfer(address,uint256) selector is 0xa9059cbb
    assert keccak256(b"transfer(address,uint256)")[:4].hex() == "a9059cbb"


@pytest.mark.parametrize("size", [0, 1, 135, 136, 137, 160, 272, 500])
def test_sponge_matches_sha3_when_padded_as_sha3(size: int) -> None:
    """The same sponge with SHA-3 padding must equal hashlib: validates multi-block absorb."""
    data = bytes(range(256)) * 2
    assert _sponge(data[:size], 0x06) == hashlib.sha3_256(data[:size]).digest()


def test_commit_hash_encoding_is_five_32_byte_words() -> None:
    circle = "0x" + "11" * 20
    member = "0x" + "22" * 20
    salt = "0x" + "33" * 32
    expected = keccak256(
        bytes.fromhex("00" * 12 + "11" * 20)
        + (7).to_bytes(32, "big")
        + bytes.fromhex("00" * 12 + "22" * 20)
        + (6_000_000).to_bytes(32, "big")
        + bytes.fromhex("33" * 32)
    )
    assert commit_hash(circle, 7, member, 6_000_000, salt) == "0x" + expected.hex()


def test_commit_hash_rejects_bad_inputs() -> None:
    addr, salt = "0x" + "00" * 20, "0x" + "00" * 32
    with pytest.raises(OverflowError):
        commit_hash(addr, 2**32, addr, 0, salt)
    with pytest.raises(ValueError):
        commit_hash("0x1234", 1, addr, 0, salt)
    with pytest.raises(ValueError):
        commit_hash(addr, 1, addr, 0, "0x00")
