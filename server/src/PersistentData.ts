import * as fs from "fs";
import * as path from "path";
import { debounce } from "./utils";

export class PersistentData<T extends object> {
    public data: T;
    private filePath: string;
    private callbacks: ((data: T) => void)[] = [];
    private callbackDebounce = debounce(() => {
        this.callbacks.forEach(callback => callback(this.data));
    }, () => 100);
    
    constructor(defaultData: T, fileName: string) {
        const handler: ProxyHandler<T> = {
            set: (target, prop, value) => {
                if(target[prop as keyof T] !== value) {
                    target[prop as keyof T] = value;
                    this.save();
                    this.callbackDebounce();
                }
                return true;
            },
            get: (target, prop) => {
                return target[prop as keyof T];
            }
        };
        
        this.data = new Proxy(defaultData, handler);
        this.filePath = path.resolve(__dirname, "..", "data", fileName);

        this.load();
        this.save(); // Save in case any fields are missing
        this.watch();
    }
    
    private load() {
        if(!fs.existsSync(this.filePath)) {
            console.warn(`Data file ${this.filePath} not found, using defaults.`);
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            this.save();
            return;
        }

        try {
            const data = fs.readFileSync(this.filePath, "utf-8");
            const parsed = JSON.parse(data) as T;
            if(!parsed || typeof parsed !== "object") {
                console.error(`Invalid data format in ${this.filePath}; keeping old data.`);
                return;
            }
            // If any fields are in parsed but not the default, drop them
            for(const key in parsed) {
                if(!(key in this.data)) {
                    delete parsed[key];
                }
            }
            // Merge with existing data
            this.data = { ...this.data, ...parsed };
            this.callbackDebounce();
            console.log(`Data loaded from ${this.filePath}`);
        } catch (err) {
            console.warn(`Could not load data from ${this.filePath}, using defaults.`, err);
        }
    }
    
    private save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
            console.log(`Data saved to ${this.filePath}`);
        } catch (err) {
            console.error(`Could not save data to ${this.filePath}`, err);
        }
    }
    
    private watch() {
        fs.watch(this.filePath, { persistent: false }, (eventType) => {
            if(eventType === "change") {
                console.log(`Data file ${this.filePath} changed, reloading...`);
                this.load();
            }
        });
    }
    
    public onChange(callback: (data: T) => void) {
        this.callbacks.push(callback);
    }
}