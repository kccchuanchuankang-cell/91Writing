import fs from 'fs';
import path from 'path';

/**
 * 简单的文件日志系统
 * 将控制台输出同时写入日志文件
 */
class Logger {
    constructor() {
        this.logsDir = './logs';
        this.currentLogFile = null;
        this.logStream = null;
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        // 确保logs目录存在
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        // 创建今天的日志文件
        this.createTodayLogFile();
        
        // 劫持console方法
        this.hijackConsole();
    }
    
    /**
     * 创建今天的日志文件
     */
    createTodayLogFile() {
        const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
        this.currentLogFile = path.join(this.logsDir, `agentic-${today}.log`);
        
        // 创建或追加写入流
        this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        
        // 写入分隔线（如果是新的会话）
        this.logStream.write(`\n${'='.repeat(80)}\n`);
        this.logStream.write(`[${new Date().toISOString()}] 日志会话开始\n`);
        this.logStream.write(`${'='.repeat(80)}\n\n`);
    }
    
    /**
     * 格式化日志消息
     */
    formatMessage(level, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        return `[${timestamp}] [${level}] ${message}\n`;
    }
    
    /**
     * 写入日志文件
     */
    writeToFile(level, args) {
        if (this.logStream) {
            try {
                const formattedMessage = this.formatMessage(level, args);
                this.logStream.write(formattedMessage);
            } catch (error) {
                // 如果写入失败，至少输出到原始console
                this.originalConsole.error('日志写入失败:', error);
            }
        }
    }
    
    /**
     * 劫持console方法
     */
    hijackConsole() {
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.writeToFile('INFO', args);
        };
        
        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.writeToFile('ERROR', args);
        };
        
        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.writeToFile('WARN', args);
        };
        
        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.writeToFile('INFO', args);
        };
    }
    
    /**
     * 关闭日志流
     */
    close() {
        if (this.logStream) {
            this.logStream.write(`\n[${new Date().toISOString()}] 日志会话结束\n`);
            this.logStream.end();
        }
    }
}

// 创建全局logger实例
const logger = new Logger();

// 监听进程退出，确保日志被写入
process.on('exit', () => {
    logger.close();
});

process.on('SIGINT', () => {
    logger.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.close();
    process.exit(0);
});

export default logger;

