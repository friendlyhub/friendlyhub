use flate2::read::GzDecoder;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::io::Read;

use crate::errors::AppError;

/// Metadata extracted from appstream.xml.gz for a single app.
#[derive(Debug, Default)]
pub struct AppstreamData {
    pub categories: Vec<String>,
    pub keywords: Vec<String>,
    pub icon_filename: Option<String>,
}

/// Fetch appstream.xml.gz from S3 and extract metadata for a specific app.
pub async fn fetch_app_metadata(
    s3_client: &aws_sdk_s3::Client,
    bucket: &str,
    app_id: &str,
) -> Result<Option<AppstreamData>, AppError> {
    let key = "repo/appstream/x86_64/appstream.xml.gz";

    let resp = s3_client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("S3 GetObject failed for {key}: {e}")))?;

    let bytes = resp
        .body
        .collect()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read S3 body: {e}")))?
        .into_bytes();

    let mut decoder = GzDecoder::new(&bytes[..]);
    let mut xml = String::new();
    decoder
        .read_to_string(&mut xml)
        .map_err(|e| AppError::Internal(format!("Failed to decompress appstream.xml.gz: {e}")))?;

    Ok(parse_appstream_for_app(&xml, app_id))
}

/// Parse the appstream XML and extract categories, keywords, and icon for a given app_id.
fn parse_appstream_for_app(xml: &str, target_app_id: &str) -> Option<AppstreamData> {
    let mut reader = Reader::from_str(xml);
    let mut path: Vec<String> = Vec::new();
    let mut text_buf = String::new();

    let mut in_target_component = false;
    let mut current_id: Option<String> = None;
    let mut data = AppstreamData::default();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                path.push(tag.clone());
                text_buf.clear();

                if tag == "component" {
                    in_target_component = false;
                    current_id = None;
                    data = AppstreamData::default();
                }

                if tag == "icon" {
                    if in_target_component {
                        // Check for cached icon with width=128
                        let icon_type = e.attributes()
                            .filter_map(|a| a.ok())
                            .find(|a| a.key.local_name().as_ref() == b"type")
                            .map(|a| String::from_utf8_lossy(&a.value).to_string());
                        let width = e.attributes()
                            .filter_map(|a| a.ok())
                            .find(|a| a.key.local_name().as_ref() == b"width")
                            .map(|a| String::from_utf8_lossy(&a.value).to_string());

                        if icon_type.as_deref() == Some("cached") && width.as_deref() == Some("128") {
                            // We'll capture the text content in the End handler
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                text_buf = e.unescape().map(|s| s.to_string()).unwrap_or_default().trim().to_string();
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                path.pop();

                match tag.as_str() {
                    "id" if path.last().map(|s| s.as_str()) == Some("component") => {
                        current_id = Some(text_buf.clone());
                        if text_buf == target_app_id {
                            in_target_component = true;
                        }
                    }
                    "category" if in_target_component => {
                        if !text_buf.is_empty() {
                            data.categories.push(text_buf.clone());
                        }
                    }
                    "keyword" if in_target_component => {
                        if !text_buf.is_empty() {
                            data.keywords.push(text_buf.clone());
                        }
                    }
                    "icon" if in_target_component => {
                        if data.icon_filename.is_none() && !text_buf.is_empty() {
                            data.icon_filename = Some(text_buf.clone());
                        }
                    }
                    "component" => {
                        if in_target_component && current_id.as_deref() == Some(target_app_id) {
                            return Some(data);
                        }
                        in_target_component = false;
                    }
                    _ => {}
                }

                text_buf.clear();
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_categories_and_keywords() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<components version="0.8" origin="flatpak">
  <component type="desktop-application">
    <id>com.example.App</id>
    <name>Example</name>
    <icon type="cached" width="128" height="128">com.example.App.png</icon>
    <categories>
      <category>Utility</category>
      <category>Network</category>
    </categories>
    <keywords>
      <keyword>clipboard</keyword>
      <keyword>sync</keyword>
    </keywords>
  </component>
  <component type="desktop-application">
    <id>com.other.App</id>
    <name>Other</name>
    <categories>
      <category>Game</category>
    </categories>
  </component>
</components>"#;

        let result = parse_appstream_for_app(xml, "com.example.App").unwrap();
        assert_eq!(result.categories, vec!["Utility", "Network"]);
        assert_eq!(result.keywords, vec!["clipboard", "sync"]);
        assert_eq!(result.icon_filename.as_deref(), Some("com.example.App.png"));

        let other = parse_appstream_for_app(xml, "com.other.App").unwrap();
        assert_eq!(other.categories, vec!["Game"]);
        assert!(other.keywords.is_empty());

        assert!(parse_appstream_for_app(xml, "com.missing.App").is_none());
    }
}
