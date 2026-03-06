use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetainfoData {
    pub id: Option<String>,
    pub name: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub developer_name: Option<String>,
    pub project_license: Option<String>,
    pub metadata_license: Option<String>,
    pub homepage_url: Option<String>,
    pub bugtracker_url: Option<String>,
    pub vcs_url: Option<String>,
    pub icon_url: Option<String>,
    pub screenshots: Vec<Screenshot>,
    pub releases: Vec<Release>,
    pub branding: Option<Branding>,
    pub content_rating: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub url: String,
    pub caption: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub version: String,
    pub date: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branding {
    pub light_color: Option<String>,
    pub dark_color: Option<String>,
}

#[derive(Debug)]
pub struct MetainfoValidation {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub data: MetainfoData,
}

pub fn parse_and_validate(xml: &str) -> MetainfoValidation {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let data = match parse_metainfo(xml) {
        Ok(d) => d,
        Err(e) => {
            return MetainfoValidation {
                valid: false,
                errors: vec![format!("Failed to parse metainfo XML: {e}")],
                warnings: vec![],
                data: MetainfoData::default(),
            };
        }
    };

    if data.id.is_none() {
        errors.push("Missing required element: <id>".into());
    }
    if data.name.is_none() {
        errors.push("Missing required element: <name>".into());
    }
    if data.summary.is_none() {
        errors.push("Missing required element: <summary>".into());
    }
    if data.description.is_none() {
        errors.push("Missing required element: <description>".into());
    }
    if data.project_license.is_none() {
        errors.push("Missing required element: <project_license>".into());
    }
    if data.developer_name.is_none() {
        warnings.push("No <developer> element found; developer name will not be shown".into());
    }
    if data.screenshots.is_empty() {
        warnings.push("No <screenshots> found; app page will have no screenshots".into());
    }
    if data.releases.is_empty() {
        warnings.push("No <releases> found; app page will have no changelog".into());
    }
    if data.metadata_license.is_none() {
        warnings.push("No <metadata_license> specified".into());
    }

    MetainfoValidation {
        valid: errors.is_empty(),
        errors,
        warnings,
        data,
    }
}

fn get_attr(e: &quick_xml::events::BytesStart, name: &str) -> Option<String> {
    e.attributes()
        .filter_map(|a| a.ok())
        .find(|a| a.key.local_name().as_ref() == name.as_bytes())
        .map(|a| String::from_utf8_lossy(&a.value).to_string())
}

fn parse_metainfo(xml: &str) -> Result<MetainfoData, String> {
    let mut reader = Reader::from_str(xml);

    let mut data = MetainfoData::default();
    let mut path: Vec<String> = Vec::new();
    let mut text_buf = String::new();

    let mut cur_screenshot: Option<Screenshot> = None;
    let mut cur_release: Option<Release> = None;
    let mut cur_release_desc = String::new();
    let mut in_release_desc = false;
    let mut cur_url_type: Option<String> = None;
    let mut cur_color_scheme: Option<String> = None;
    let mut in_top_description = false;
    let mut description_html = String::new();
    let mut desc_depth: usize = 0;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                path.push(tag.clone());
                text_buf.clear();

                match tag.as_str() {
                    "description" => {
                        if path_matches(&path, &["component", "description"]) {
                            in_top_description = true;
                            description_html.clear();
                            desc_depth = 0;
                        } else if cur_release.is_some() {
                            in_release_desc = true;
                            cur_release_desc.clear();
                        }
                    }
                    "screenshot" => {
                        let is_default = get_attr(e, "type").as_deref() == Some("default");
                        cur_screenshot = Some(Screenshot {
                            url: String::new(),
                            caption: None,
                            is_default,
                        });
                    }
                    "release" => {
                        cur_release = Some(Release {
                            version: get_attr(e, "version").unwrap_or_default(),
                            date: get_attr(e, "date"),
                            description: None,
                        });
                    }
                    "url" => {
                        cur_url_type = get_attr(e, "type");
                    }
                    "color" => {
                        cur_color_scheme = get_attr(e, "scheme_preference");
                    }
                    "p" | "ul" | "ol" | "li" | "em" | "code" => {
                        if in_top_description {
                            description_html.push_str(&format!("<{tag}>"));
                            desc_depth += 1;
                        }
                        if in_release_desc {
                            cur_release_desc.push_str(&format!("<{tag}>"));
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                match tag.as_str() {
                    "content_rating" => {
                        data.content_rating = get_attr(e, "type");
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = e.unescape().map(|s| s.to_string()).unwrap_or_default();
                let trimmed = text.trim().to_string();

                // For description elements, accumulate HTML
                let current = path.last().map(|s| s.as_str()).unwrap_or("");
                if in_top_description
                    && matches!(current, "p" | "li" | "em" | "code")
                {
                    description_html.push_str(&trimmed);
                } else if in_release_desc
                    && matches!(current, "p" | "li" | "em" | "code")
                {
                    cur_release_desc.push_str(&trimmed);
                } else {
                    text_buf = trimmed;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                let text = text_buf.trim().to_string();

                match tag.as_str() {
                    "id" if path_matches(&path, &["component", "id"]) => {
                        if !text.is_empty() {
                            data.id = Some(text.clone());
                        }
                    }
                    "name" if path_matches(&path, &["component", "name"]) => {
                        if !text.is_empty() {
                            data.name = Some(text.clone());
                        }
                    }
                    "name" if path_matches(&path, &["component", "developer", "name"]) => {
                        if !text.is_empty() {
                            data.developer_name = Some(text.clone());
                        }
                    }
                    "summary" if path_matches(&path, &["component", "summary"]) => {
                        if !text.is_empty() {
                            data.summary = Some(text.clone());
                        }
                    }
                    "project_license" => {
                        if !text.is_empty() {
                            data.project_license = Some(text.clone());
                        }
                    }
                    "metadata_license" => {
                        if !text.is_empty() {
                            data.metadata_license = Some(text.clone());
                        }
                    }
                    "image" if cur_screenshot.is_some() => {
                        if let Some(ref mut s) = cur_screenshot {
                            s.url = text.clone();
                        }
                    }
                    "caption" if cur_screenshot.is_some() => {
                        if let Some(ref mut s) = cur_screenshot {
                            s.caption = Some(text.clone());
                        }
                    }
                    "screenshot" => {
                        if let Some(s) = cur_screenshot.take() {
                            if !s.url.is_empty() {
                                data.screenshots.push(s);
                            }
                        }
                    }
                    "url" => {
                        if !text.is_empty() {
                            match cur_url_type.as_deref() {
                                Some("homepage") => data.homepage_url = Some(text.clone()),
                                Some("bugtracker") => data.bugtracker_url = Some(text.clone()),
                                Some("vcs-browser") => data.vcs_url = Some(text.clone()),
                                _ => {}
                            }
                        }
                        cur_url_type = None;
                    }
                    "icon" => {
                        if text.starts_with("http://") || text.starts_with("https://") {
                            data.icon_url = Some(text.clone());
                        }
                    }
                    "color" => {
                        if !text.is_empty() {
                            let branding = data.branding.get_or_insert(Branding {
                                light_color: None,
                                dark_color: None,
                            });
                            match cur_color_scheme.as_deref() {
                                Some("light") => branding.light_color = Some(text.clone()),
                                Some("dark") => branding.dark_color = Some(text.clone()),
                                _ => {}
                            }
                        }
                        cur_color_scheme = None;
                    }
                    "description" => {
                        if in_top_description && path_matches(&path, &["component", "description"]) {
                            data.description = Some(description_html.trim().to_string());
                            in_top_description = false;
                        }
                        if in_release_desc {
                            in_release_desc = false;
                        }
                    }
                    "release" => {
                        if let Some(mut r) = cur_release.take() {
                            let desc = cur_release_desc.trim().to_string();
                            if !desc.is_empty() {
                                r.description = Some(desc);
                            }
                            data.releases.push(r);
                        }
                        cur_release_desc.clear();
                    }
                    "p" | "ul" | "ol" | "li" | "em" | "code" => {
                        if in_top_description {
                            description_html.push_str(&format!("</{tag}>"));
                            desc_depth = desc_depth.saturating_sub(1);
                        }
                        if in_release_desc {
                            cur_release_desc.push_str(&format!("</{tag}>"));
                        }
                    }
                    _ => {}
                }

                text_buf.clear();
                path.pop();
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(format!(
                    "XML parse error at position {}: {e}",
                    reader.error_position()
                ));
            }
            _ => {}
        }
    }

    Ok(data)
}

fn path_matches(path: &[String], suffix: &[&str]) -> bool {
    if path.len() < suffix.len() {
        return false;
    }
    let start = path.len() - suffix.len();
    path[start..]
        .iter()
        .zip(suffix.iter())
        .all(|(a, b)| a == *b)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_METAINFO: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>com.example.testapp</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>GPL-3.0-or-later</project_license>
  <name>Test App</name>
  <summary>A test application</summary>
  <description>
    <p>This is a test application for unit testing.</p>
    <p>Features include:</p>
    <ul>
      <li>Feature one</li>
      <li>Feature two</li>
    </ul>
  </description>
  <developer id="com.example">
    <name>Example Developer</name>
  </developer>
  <screenshots>
    <screenshot type="default" xml:lang="en">
      <image>https://example.com/screenshot1.png</image>
      <caption>Main window</caption>
    </screenshot>
    <screenshot xml:lang="en">
      <image>https://example.com/screenshot2.png</image>
      <caption>Settings</caption>
    </screenshot>
  </screenshots>
  <url type="homepage">https://example.com</url>
  <url type="bugtracker">https://github.com/example/testapp/issues</url>
  <url type="vcs-browser">https://github.com/example/testapp</url>
  <branding>
    <color type="primary" scheme_preference="light">#ffffff</color>
    <color type="primary" scheme_preference="dark">#000000</color>
  </branding>
  <content_rating type="oars-1.1" />
  <releases>
    <release version="1.0.0" date="2026-01-01">
      <description>
        <p>Initial release.</p>
      </description>
    </release>
    <release version="0.9.0" date="2025-12-01">
      <description>
        <ul>
          <li>Beta feature A</li>
          <li>Beta feature B</li>
        </ul>
      </description>
    </release>
  </releases>
</component>"#;

    #[test]
    fn parses_basic_fields() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        assert!(result.valid, "errors: {:?}", result.errors);
        assert_eq!(result.data.id.as_deref(), Some("com.example.testapp"));
        assert_eq!(result.data.name.as_deref(), Some("Test App"));
        assert_eq!(result.data.summary.as_deref(), Some("A test application"));
        assert_eq!(
            result.data.project_license.as_deref(),
            Some("GPL-3.0-or-later")
        );
        assert_eq!(result.data.metadata_license.as_deref(), Some("CC0-1.0"));
    }

    #[test]
    fn parses_developer() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        assert_eq!(
            result.data.developer_name.as_deref(),
            Some("Example Developer")
        );
    }

    #[test]
    fn parses_screenshots() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        assert_eq!(result.data.screenshots.len(), 2);
        assert!(result.data.screenshots[0].is_default);
        assert_eq!(
            result.data.screenshots[0].url,
            "https://example.com/screenshot1.png"
        );
        assert_eq!(
            result.data.screenshots[0].caption.as_deref(),
            Some("Main window")
        );
        assert!(!result.data.screenshots[1].is_default);
    }

    #[test]
    fn parses_urls() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        assert_eq!(
            result.data.homepage_url.as_deref(),
            Some("https://example.com")
        );
        assert_eq!(
            result.data.bugtracker_url.as_deref(),
            Some("https://github.com/example/testapp/issues")
        );
        assert_eq!(
            result.data.vcs_url.as_deref(),
            Some("https://github.com/example/testapp")
        );
    }

    #[test]
    fn parses_branding() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        let branding = result.data.branding.as_ref().unwrap();
        assert_eq!(branding.light_color.as_deref(), Some("#ffffff"));
        assert_eq!(branding.dark_color.as_deref(), Some("#000000"));
    }

    #[test]
    fn parses_releases() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        assert_eq!(result.data.releases.len(), 2);
        assert_eq!(result.data.releases[0].version, "1.0.0");
        assert_eq!(result.data.releases[0].date.as_deref(), Some("2026-01-01"));
        assert!(result.data.releases[0]
            .description
            .as_ref()
            .unwrap()
            .contains("Initial release"));
        assert_eq!(result.data.releases[1].version, "0.9.0");
    }

    #[test]
    fn parses_description_html() {
        let result = parse_and_validate(SAMPLE_METAINFO);
        let desc = result.data.description.as_ref().unwrap();
        assert!(desc.contains("<p>"), "desc: {desc}");
        assert!(desc.contains("<ul>"), "desc: {desc}");
        assert!(desc.contains("<li>Feature one</li>"), "desc: {desc}");
    }

    #[test]
    fn missing_required_fields() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
</component>"#;
        let result = parse_and_validate(xml);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("<id>")));
        assert!(result.errors.iter().any(|e| e.contains("<name>")));
        assert!(result.errors.iter().any(|e| e.contains("<summary>")));
        assert!(result
            .errors
            .iter()
            .any(|e| e.contains("<project_license>")));
    }

    #[test]
    fn invalid_xml() {
        let result = parse_and_validate("<broken><unclosed>");
        assert!(!result.valid);
    }

    #[test]
    fn parses_real_metainfo() {
        let xml = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../dev/com.keithvassallo.clustercut.metainfo.xml"
        ));
        if let Ok(xml) = xml {
            let result = parse_and_validate(&xml);
            assert!(result.valid, "errors: {:?}", result.errors);
            assert_eq!(
                result.data.id.as_deref(),
                Some("com.keithvassallo.clustercut")
            );
            assert_eq!(result.data.name.as_deref(), Some("ClusterCut"));
            assert_eq!(
                result.data.developer_name.as_deref(),
                Some("Keith Vassallo")
            );
            assert_eq!(result.data.screenshots.len(), 7);
            assert_eq!(result.data.releases.len(), 6);
            assert_eq!(
                result.data.project_license.as_deref(),
                Some("GPL-3.0-or-later")
            );
        }
    }
}
