use std::fmt;

/// 统一错误类型,可序列化为字符串返回给前端
#[derive(Debug)]
#[allow(dead_code)]
pub struct AppError(pub String);

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError(format!("IO 错误: {e}"))
    }
}

impl From<walkdir::Error> for AppError {
    fn from(e: walkdir::Error) -> Self {
        AppError(format!("遍历错误: {e}"))
    }
}

impl From<regex::Error> for AppError {
    fn from(e: regex::Error) -> Self {
        AppError(format!("正则错误: {e}"))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError(format!("序列化错误: {e}"))
    }
}

/// 命令返回类型
pub type CmdResult<T> = Result<T, String>;

#[allow(dead_code)]
pub fn err<T>(msg: impl Into<String>) -> CmdResult<T> {
    Err(msg.into())
}

pub fn map_err<E: fmt::Display>(e: E) -> String {
    e.to_string()
}
