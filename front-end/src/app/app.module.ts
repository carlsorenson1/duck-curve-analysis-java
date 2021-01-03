import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { EnergyService } from './energy.service';

import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';
import { ExploreComponent } from './explore.component';

@NgModule({
  declarations: [
    AppComponent, HomeComponent, ExploreComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot([
      { path: 'explore', component: ExploreComponent },
      { path: '', component: HomeComponent }
    ], { useHash: true })
  ],
  providers: [
    EnergyService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
