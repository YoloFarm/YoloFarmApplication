import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './forbidden-page.component.html',
  styleUrl: './forbidden-page.component.scss'
})
export class ForbiddenPageComponent {}
