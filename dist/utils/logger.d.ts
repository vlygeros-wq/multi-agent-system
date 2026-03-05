export declare const logger: {
    info(source: string, message: string): void;
    warn(source: string, message: string): void;
    error(source: string, message: string): void;
    success(source: string, message: string): void;
    bus(message: string): void;
    divider(): void;
};
