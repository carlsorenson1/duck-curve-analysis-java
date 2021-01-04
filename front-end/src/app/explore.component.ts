import { Component, OnInit } from '@angular/core';
import { IDatapoint } from './datapoint';
import { EnergyService } from './energy.service';

@Component({
  selector: 'app-root',
  templateUrl: './explore.component.html'
})
export class ExploreComponent implements OnInit {
  currentDate: Date;
  currentMonth: Date;

  startDate: Date;
  endDate: Date;
  endMonth: Date;

  displayMode: string;

  totalPowerDatapoints: IDatapoint[];
  whDatapoints: IDatapoint[];
  carDatapoints: IDatapoint[];
  hvacDatapoints: IDatapoint[];
  calculatedDatapoints: IDatapoint[];

  solarDatapoints: IDatapoint[];
  solarLinePointsMonthly: string;
  solarLinePointsDaily: string;

  rampRateDownAverage: number;
  rampRateDownMedian: number;
  rampRateDownExtreme: number;

  rampRateUpAverage: number;
  rampRateUpMedian: number;
  rampRateUpExtreme: number;

  solarEnabled = true;
  waterHeaterEnabled = true;
  carEnabled = true;
  hvacEnabled = true;

  displayModes = [
    {value: 'weekdays', text: 'Weekday average'},
    {value: 'weekends', text: 'Weekend average'},
    {value: 'all', text: 'All days average'},
    {value: 'single', text: 'Single days only'}
  ];

  monthlyZeroLine = 350;
  dailyZeroLine = 465;

  xAxis = 558;

  onChangeDisplayMode(mode: string): void {
    this.log(mode);
    this.displayMode = mode;
    this.updateDatapoints();
  }

  wattsToPixelsMonthly(watts: number, pxOffset: number = 0): number {
    return watts / 12 + pxOffset;
  }

  wattsToPixelsSingle(watts: number, pxOffset: number = 0): number {
    return watts / 32 + pxOffset;
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  max(value1: number, value2: number): number {
    return Math.max(value1, value2);
  }

  previousMonth(): void {
    const newDate = new Date(this.currentMonth.valueOf());
    let month = newDate.getUTCMonth();

    if (month === 1) {
      month = 12;
      const year = newDate.getUTCFullYear() - 1;
      newDate.setUTCFullYear(year);
    }
    else {
      month = month - 1;
    }

    newDate.setUTCMonth(month);
    this.currentMonth = newDate;
    this.updateDatapoints();
  }

  nextMonth(): void {
    const newDate = new Date(this.currentMonth.valueOf());
    let month = newDate.getUTCMonth();

    if (month === 12) {
      month = 1;
      const year = newDate.getUTCFullYear() + 1;
      newDate.setUTCFullYear(year);
    }
    else {
      month = month + 1;
    }

    newDate.setUTCMonth(month);
    this.currentMonth = newDate;
    this.updateDatapoints();
  }

  previousDay(): void {
    const newDate = new Date(this.currentDate.valueOf());
    newDate.setUTCDate(newDate.getUTCDate() - 1);
    this.currentDate = newDate;
    this.updateDatapoints();
  }

  nextDay(): void {
    const newDate = new Date(this.currentDate.valueOf());
    newDate.setUTCDate(newDate.getUTCDate() + 1);
    this.currentDate = newDate;
    this.updateDatapoints();
  }

  constructor(private energyDataService: EnergyService) {

  }

  updateDatapoints(): void {
    switch (this.displayMode) {
    case 'weekdays':
    case 'weekends':
    case 'all':
      if (!this.waterHeaterEnabled) {
        this.energyDataService.getEnergyAverages('wh', this.displayMode, this.currentMonth)
          .subscribe( datapoints => {
              this.whDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      if (!this.carEnabled) {
        this.energyDataService.getEnergyAverages('car', this.displayMode, this.currentMonth)
          .subscribe( datapoints => {
              this.carDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      if (!this.hvacEnabled) {
        this.energyDataService.getEnergyAverages('hvac', this.displayMode, this.currentMonth)
          .subscribe( datapoints => {
              this.hvacDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      this.energyDataService.getEnergyAverages('total', this.displayMode, this.currentMonth)
      .subscribe( datapoints => {
          this.totalPowerDatapoints = datapoints;
          this.recalculateDatapoints();
        },
          error => {
            this.log(error);
      });
      break;
    case 'single':
      if (!this.waterHeaterEnabled) {
        this.energyDataService.getEnergyForDate('wh', this.currentDate)
          .subscribe( datapoints => {
              this.whDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      if (!this.carEnabled) {
        this.energyDataService.getEnergyForDate('car', this.currentDate)
          .subscribe( datapoints => {
              this.carDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      if (!this.hvacEnabled) {
        this.energyDataService.getEnergyForDate('hvac', this.currentDate)
          .subscribe( datapoints => {
              this.hvacDatapoints = datapoints;
              this.recalculateDatapoints();
            },
            error => {
              this.log(error);
            });
      }
      this.energyDataService.getEnergyForDate('total', this.currentDate)
      .subscribe( datapoints => {
          this.totalPowerDatapoints = datapoints;
          this.recalculateDatapoints();
      },
        error => {
          this.log(error);
        }
      );
      break;
    }
  }

  recalculateDatapoints(): void {
    if (this.calculatedDatapoints == null) {
      this.calculatedDatapoints = new Array<IDatapoint>(48);
      for (let i = 0; i < 48; i++) {
        this.calculatedDatapoints[i] = { startTime: new Date(), averagePowerWatts: 0};
      }
    }

    for (let i = 0; i < 48; i++) {
      const solarWatts = this.solarEnabled ? this.solarDatapoints[i].averagePowerWatts : 0;
      this.calculatedDatapoints[i].averagePowerWatts = this.totalPowerDatapoints[i].averagePowerWatts - solarWatts;
      this.calculatedDatapoints[i].startTime = this.totalPowerDatapoints[i].startTime;

      if (!this.waterHeaterEnabled && this.whDatapoints != null) {
        this.calculatedDatapoints[i].averagePowerWatts -= this.whDatapoints[i].averagePowerWatts;
      }

      if (!this.carEnabled && this.carDatapoints != null) {
        this.calculatedDatapoints[i].averagePowerWatts -= this.carDatapoints[i].averagePowerWatts;
      }

      if (!this.hvacEnabled && this.hvacDatapoints != null) {
        this.calculatedDatapoints[i].averagePowerWatts -= this.hvacDatapoints[i].averagePowerWatts;
      }
    }
    this.calculateRampRates();
  }

  calculateRampRates(): void {
    const up: number[] = new Array<number>(10);
    const down: number[] = new Array<number>(10);

    let last = this.calculatedDatapoints[30].averagePowerWatts;
    for (let i = 31; i < 41; i++) {
      up[i - 31] = this.calculatedDatapoints[i].averagePowerWatts - last;
      last = this.calculatedDatapoints[i].averagePowerWatts;
    }
    this.rampRateUpAverage = this.average(...up);
    this.rampRateUpMedian = this.median(...up);
    this.rampRateUpExtreme = this.extreme(...up);


    last = this.calculatedDatapoints[12].averagePowerWatts;
    for (let i = 13; i < 23; i++) {
      down[i - 13] = this.calculatedDatapoints[i].averagePowerWatts - last;
      last = this.calculatedDatapoints[i].averagePowerWatts;
    }
    this.rampRateDownAverage = this.average(...down);
    this.rampRateDownMedian = this.median(...down);
    this.rampRateDownExtreme = this.extreme(...down);
  }

  extreme(...values: number[]): number {
    let extreme = 0;
    values.forEach(v => {
      if (Math.abs(v) > Math.abs(extreme)) {
        extreme = v;
      }
    });

    return extreme;
  }

  average(...values: number[]): number {
    let sum = 0;
    values.forEach(v => {
      sum += v;
    });

    return sum / values.length;
  }

  median(...values: number[]): number {
    // The default sort is lexicographical.
    values.sort((v1, v2) => {
      if (v1 > v2) { return 1; }
      if (v1 < v2) { return -1; }
      return 0;
    });

    if (values.length % 2 === 0) {
      return (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    }
    else {
      return values[(values.length - 1) / 2];
    }
  }

  log(message): void {
    console.log(message);
    // document.getElementById('debugDiv').innerHTML += ('<p>' + message + '</p>');
  }

  ngOnInit(): void {
    this.log('initing');
    this.currentDate = new Date('2020-12-31');
    this.endDate = new Date('2020-12-31');
    this.endMonth = new Date('2020-12-01');

    this.currentMonth = new Date(this.endMonth.getTime());
    this.currentMonth.setUTCDate(1);

    this.startDate = new Date('2020-10-01');

    this.displayMode = 'weekdays';

    this.energyDataService.getSolarValues()
      .subscribe( solarValues => {
          this.solarDatapoints = solarValues;
          this.solarLinePointsMonthly = '';
          this.solarLinePointsDaily = '';
          for (let i = 14; i < 39; i++){
            this.solarLinePointsMonthly +=
              (i * 25 + 65) + ' ' + (this.monthlyZeroLine - this.wattsToPixelsMonthly(this.solarDatapoints[i].averagePowerWatts)) + ',';
            this.solarLinePointsDaily +=
              (i * 25 + 65) + ' ' + (this.dailyZeroLine - this.wattsToPixelsSingle(this.solarDatapoints[i].averagePowerWatts)) + ',';
          }
          this.solarLinePointsMonthly = this.solarLinePointsMonthly.slice(0, -1);
          this.solarLinePointsDaily = this.solarLinePointsDaily.slice(0, -1);
          this.updateDatapoints();
        },
        error => {
          this.log(error);
        });
  }
}
