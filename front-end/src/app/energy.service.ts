import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { IDatapoint } from './datapoint';

@Injectable()
export class EnergyService {
  private apiUrl = 'https://api.duck-curve-analysis.com/api';

  constructor(private http: HttpClient) { }

  zeroPad(value: number): string {
    let stringValue = value.toString();
    if (stringValue.length < 2) {
        stringValue = '0' + stringValue;
    }
    return stringValue;
  }

  getSolarValues(): Observable<IDatapoint[]> {
    const url = `${this.apiUrl}/solar`;
    return this.http.get<IDatapoint[]>(url);
  }

  getEnergyAverages(feed: string, mode: string, selectedDate: Date): Observable<IDatapoint[]> {
    const url = `${this.apiUrl}/${feed}/average/${mode}/${this.zeroPad(selectedDate.getUTCFullYear())}-${this.zeroPad(selectedDate.getUTCMonth() + 1)}-${this.zeroPad(selectedDate.getUTCDate())}`
    console.log(selectedDate, selectedDate.getDate());
    return this.http.get<IDatapoint[]>(url);
  }

  getEnergyForDate(feed: string, selectedDate: Date): Observable<IDatapoint[]> {
    const url = `${this.apiUrl}/${feed}/day/${this.zeroPad(selectedDate.getUTCFullYear())}-${this.zeroPad(selectedDate.getUTCMonth() + 1)}-${this.zeroPad(selectedDate.getUTCDate())}`
    console.log(selectedDate, selectedDate.getDate());
    return this.http.get<IDatapoint[]>(url);
  }

  private handleError(err: HttpErrorResponse): void {
      // in a real world app, we may send the server to some remote logging infrastructure
      // instead of just logging it to the console
      let errorMessage = '';
      if (err.error instanceof Error) {
          // A client-side or network error occurred. Handle it accordingly.
          errorMessage = `An error occurred: ${err.error.message}`;
      } else {
          // The backend returned an unsuccessful response code.
          // The response body may contain clues as to what went wrong,
          errorMessage = `Server returned code: ${err.status}, error message is: ${err.message}`;
      }
      console.error(errorMessage);
  }
}
