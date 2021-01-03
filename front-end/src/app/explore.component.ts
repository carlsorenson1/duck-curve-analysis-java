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
  datapoints: any[];
  maxRampRateDown: number;
  maxRampRateUp: number;
  maxRampRateDownPercent: number;
  maxRampRateUpPercent: number;

  oldLog: any;

  displayModes = [
    {value: 'weekdays', text: 'Weekday average'},
    {value: 'weekends', text: 'Weekend average'},
    {value: 'all', text: 'All days average'},
    {value: 'single', text: 'Single days only'}
  ];

  onChangeDisplayMode(mode: string): void {
    this.log(mode);
    this.displayMode = mode;
    this.updateDatapoints();
  }

  getLineArray(): number[] {
    return Array(15);
  }

  wattsToPixelsMonthly(watts: number, pxOffset: number = 0): number {
    return watts / 12 + pxOffset;
  }

  wattsToPixelsSingle(watts: number, pxOffset: number = 0): number {
    return watts / 40 + pxOffset;
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
        this.energyDataService.getEnergyAverages(this.displayMode, this.currentMonth)
        .subscribe( datapoints => {
            this.log('Got averages: ' + datapoints.length);
            this.datapoints = datapoints;
            this.calculateRampRates(datapoints);
          },
            error => {
              this.log(error);
        });
        break;
    case 'single':
        this.energyDataService.getEnergyForDate(this.currentDate)
        .subscribe( datapoints => {
            this.log('Got day values: ' + datapoints.length);
            this.datapoints = datapoints;
            this.calculateRampRates(datapoints);
        },
          error => {
            this.log(error);
          }
        );
        break;
    }
  }

  calculateRampRates(datapoints: IDatapoint[]): void {
    this.maxRampRateUp = 0;
    this.maxRampRateUpPercent = 0;
    let last = datapoints[30].averagePowerWatts;
    for (let i = 31; i < 41; i++) {
      const temp = datapoints[i].averagePowerWatts - last;
      const tempUpPercent = temp / last;
      this.maxRampRateUp = Math.max(temp, this.maxRampRateUp);
      this.maxRampRateUpPercent = Math.max(tempUpPercent, this.maxRampRateUpPercent);
      last = datapoints[i].averagePowerWatts;
    }
    this.maxRampRateUpPercent = Math.floor(this.maxRampRateUpPercent * 100);

    this.maxRampRateDown = 0;
    this.maxRampRateDownPercent = 0;
    last = datapoints[12].averagePowerWatts;
    for (let i = 13; i < 23; i++) {
      const temp = last - datapoints[i].averagePowerWatts;
      const tempDownPercent = temp / last;
      this.maxRampRateDown = Math.max(temp, this.maxRampRateDown);
      this.maxRampRateDownPercent = Math.max(tempDownPercent, this.maxRampRateDownPercent);
      last = datapoints[i].averagePowerWatts;
    }
    this.maxRampRateDownPercent = Math.floor(this.maxRampRateDownPercent * 100);
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
    this.updateDatapoints();
  }

}
