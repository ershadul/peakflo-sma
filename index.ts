import moment from "moment";
import { parse } from "csv-parse";
import fs from "fs";

moment().weekday(0); // Sunday is the first day of the week

export type FareRuleType = { [key: string]: number };

export type PeakHoursType = { [key: string]: Array<string[]> };

export class FareCalulator {
    peakHours: PeakHoursType;
    fareRules: FareRuleType;
    totalFare: number = 0;

    constructor(peakHours: PeakHoursType, fareRules: FareRuleType) {
        this.peakHours = peakHours;
        this.fareRules = fareRules;
    }

    isPeakHour(date: Date): boolean {
        const day: string = date.getDay().toString();
        const hours = this.peakHours[day];
        const time = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const format = 'hh:mm'
        for (let i = 0; i < hours.length; i++) {
            if (moment(time, format).isBetween(moment(hours[i][0], format), moment(hours[i][1], format))) {
                return true;
            }
        }
        return false;
    }

    getFare(fromLine: string, toLine: string, date: Date): number {
        const peak = this.isPeakHour(date);
        const fareRule = `${fromLine}-${toLine}-${peak ? 'Peak' : 'NonPeak'}`;
        return this.fareRules[fareRule];
    }
    
    getDailyCap(fromLine: string, toLine: string): number {
        const fareRule = `${fromLine}-${toLine}-DailyCap`;
        return this.fareRules[fareRule];
    }

    getWeeklyCap(fromLine: string, toLine: string): number {
        const fareRule = `${fromLine}-${toLine}-WeeklyCap`;
        return this.fareRules[fareRule];
    }

    calculateFare(csvFilePath: string) {
        const travelCostDaily: { [key: string]: number } = {};
        const travelCostWeekly: { [key: string]: number } = {};
        const self = this;
        fs.createReadStream(csvFilePath)
            .pipe(parse({ delimiter: ",", from_line: 1 }))
            .on('data', function (row: string[]) {
                const fromLine = row[0].trim();
                const toLine = row[1].trim();
                const date = row[2].trim();
                const d = new Date(date);
                let potentialAdditionForDay = 0;
    
                const fare = self.getFare(fromLine, toLine, d);
                const dailyCap = self.getDailyCap(fromLine, toLine);
                const weeklyCap = self.getWeeklyCap(fromLine, toLine);
    
                const dayKey = `${d.toLocaleDateString('en-US')}-${fromLine}-${toLine}`;
                potentialAdditionForDay = 0;
    
                if (travelCostDaily[dayKey]) {
                    if (travelCostDaily[dayKey] < dailyCap) {
                        potentialAdditionForDay = (travelCostDaily[dayKey] + fare) <= dailyCap ? fare : (dailyCap - travelCostDaily[dayKey]);
                        travelCostDaily[dayKey] += potentialAdditionForDay;
                    }
                } else {
                    travelCostDaily[dayKey] = potentialAdditionForDay = fare;
                }
    
                const week = moment(d).week().toString();
                const weekKey = `${d.getFullYear()}-${week}-${fromLine}-${toLine}`;
    
                if (travelCostWeekly[weekKey]) {
                    if (travelCostWeekly[weekKey] < weeklyCap) {
                        if ((travelCostWeekly[weekKey] + potentialAdditionForDay) > weeklyCap) {
                            travelCostWeekly[weekKey] = weeklyCap;
                        } else {
                            travelCostWeekly[weekKey] += potentialAdditionForDay;
                        }
                    }
                } else {
                    travelCostWeekly[weekKey] = potentialAdditionForDay;
                }
            })
            .on('end', function () {
                const total = Object.values(travelCostWeekly).reduce((acc, curr) => acc + curr, 0);
                self.totalFare = total;
                console.log(self.totalFare);
            })
            .on('error', function (error: Error) {
                console.log(error.message);
            });
    }
}

if (require.main === module) {
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Please provide a csv file path (absolute or relative) as an argument.');
        console.log('Example: npm run calfare ./data/test.csv');
        console.log('Example with relative path: npm run calfare ./data/test.csv');
        console.log('Example with absolute path: npm run calfare /Users/username/Documents/test.csv');
        process.exit(1);
    }

    const FareRules: FareRuleType = {
        // green-green
        'Green-Green-Peak': 2,
        'Green-Green-NonPeak': 1,
        'Green-Green-DailyCap': 8,
        'Green-Green-WeeklyCap': 55,
        // red-red
        'Red-Red-Peak': 3,
        'Red-Red-NonPeak': 2,
        'Red-Red-DailyCap': 12,
        'Red-Red-WeeklyCap': 70,
        // green-red
        'Green-Red-Peak': 4,
        'Green-Red-NonPeak': 3,
        'Green-Red-DailyCap': 15,
        'Green-Red-WeeklyCap': 90,
        // red-green
        'Red-Green-Peak': 3,
        'Red-Green-NonPeak': 2,
        'Red-Green-DailyCap': 15,
        'Red-Green-WeeklyCap': 90,
    };

    const PeakHours: PeakHoursType  = {
        // Sunday
        '0': [
            ['18:00', '23:00'],
        ],
        '1': [
            ['08:00', '10:00'],
            ['16:30', '19:00'],
        ],
        '2': [
            ['08:00', '10:00'],
            ['16:30', '19:00'],
        ],
        '3': [
            ['08:00', '10:00'],
            ['16:30', '19:00'],
        ],
        '4': [
            ['08:00', '10:00'],
            ['16:30', '19:00'],
        ],
        '5': [
            ['08:00', '10:00'],
            ['16:30', '19:00'],
        ],
        // Saturday
        '6': [
            ['10:00', '14:00'],
            ['18:00', '23:00'],
        ],
    };

    const calculator = new FareCalulator(PeakHours, FareRules);
    calculator.calculateFare(args[0]);
}
