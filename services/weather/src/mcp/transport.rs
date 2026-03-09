use std::io;

use serde_json::Value;
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub(super) async fn read_frame<R>(reader: &mut R) -> io::Result<Option<Vec<u8>>>
where
    R: AsyncBufRead + Unpin,
{
    let mut content_length: Option<usize> = None;

    loop {
        let mut line = String::new();
        let bytes = reader.read_line(&mut line).await?;

        if bytes == 0 {
            if content_length.is_some() {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "Unexpected EOF while reading MCP headers",
                ));
            }

            return Ok(None);
        }

        if line == "\r\n" || line == "\n" {
            break;
        }

        let mut split = line.splitn(2, ':');
        let header_name = split.next().unwrap_or("").trim().to_ascii_lowercase();
        let header_value = split.next().unwrap_or("").trim();

        if header_name == "content-length" {
            content_length = Some(header_value.parse::<usize>().map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Invalid Content-Length header: {error}"),
                )
            })?);
        }
    }

    let length = content_length.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Missing Content-Length header in MCP frame",
        )
    })?;

    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload).await?;
    Ok(Some(payload))
}

pub(super) async fn write_frame<W>(writer: &mut W, payload: &Value) -> io::Result<()>
where
    W: AsyncWrite + Unpin,
{
    let encoded = serde_json::to_vec(payload).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Failed to serialize JSON-RPC payload: {error}"),
        )
    })?;

    let header = format!("Content-Length: {}\r\n\r\n", encoded.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(&encoded).await?;
    writer.flush().await?;
    Ok(())
}
