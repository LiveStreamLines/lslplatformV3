import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.css'
})
export class ColorPickerComponent implements OnInit {
  primaryColor: string = '#5621d2';
  isExpanded: boolean = false;

  ngOnInit() {
    // Get current primary color from CSS variable
    const root = document.documentElement;
    const currentColor = getComputedStyle(root).getPropertyValue('--primary-color').trim();
    if (currentColor) {
      this.primaryColor = currentColor;
    }
  }

  onColorChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const color = input.value;
    
    // Validate hex color format
    if (/^#([A-Fa-f0-9]{6})$/.test(color)) {
      this.primaryColor = color;
      this.updatePrimaryColor(color);
    } else if (input.type === 'color') {
      // Color input always returns valid hex
      this.primaryColor = color;
      this.updatePrimaryColor(color);
    }
  }

  updatePrimaryColor(color: string) {
    const root = document.documentElement;
    
    // Set primary color
    root.style.setProperty('--primary-color', color);
    
    // Calculate and set related colors
    const rgb = this.hexToRgb(color);
    if (rgb) {
      // Dark variant (darker version)
      const darkRgb = {
        r: Math.max(0, rgb.r - 120),
        g: Math.max(0, rgb.g - 120),
        b: Math.max(0, rgb.b - 120)
      };
      root.style.setProperty('--primary-color-dark', this.rgbToHex(darkRgb.r, darkRgb.g, darkRgb.b));
      
      // Light variant (lighter version)
      const lightRgb = {
        r: Math.min(255, rgb.r + 30),
        g: Math.min(255, rgb.g + 30),
        b: Math.min(255, rgb.b + 30)
      };
      root.style.setProperty('--primary-color-light', this.rgbToHex(lightRgb.r, lightRgb.g, lightRgb.b));
      
      // Background variant (very light)
      const bgRgb = {
        r: Math.min(255, rgb.r + 200),
        g: Math.min(255, rgb.g + 200),
        b: Math.min(255, rgb.b + 200)
      };
      root.style.setProperty('--primary-color-bg', this.rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b));
      
      // Border variant (light)
      const borderRgb = {
        r: Math.min(255, rgb.r + 180),
        g: Math.min(255, rgb.g + 180),
        b: Math.min(255, rgb.b + 180)
      };
      root.style.setProperty('--primary-color-border', this.rgbToHex(borderRgb.r, borderRgb.g, borderRgb.b));
      
      // Hover variant (medium light)
      const hoverRgb = {
        r: Math.min(255, rgb.r + 100),
        g: Math.min(255, rgb.g + 100),
        b: Math.min(255, rgb.b + 100)
      };
      root.style.setProperty('--primary-color-hover', this.rgbToHex(hoverRgb.r, hoverRgb.g, hoverRgb.b));
      
      // Gradient colors
      // Gradient start (lighter version of primary color)
      const gradientStartRgb = {
        r: Math.min(255, rgb.r + 80),
        g: Math.min(255, rgb.g + 80),
        b: Math.min(255, rgb.b + 80)
      };
      root.style.setProperty('--gradient-start', this.rgbToHex(gradientStartRgb.r, gradientStartRgb.g, gradientStartRgb.b));
      
      // Gradient end (very light version of primary color - almost white)
      const gradientEndRgb = {
        r: Math.min(255, rgb.r + 240),
        g: Math.min(255, rgb.g + 240),
        b: Math.min(255, rgb.b + 240)
      };
      root.style.setProperty('--gradient-end', this.rgbToHex(gradientEndRgb.r, gradientEndRgb.g, gradientEndRgb.b));
      
      // Gradient card start (light version of primary color)
      const gradientCardStartRgb = {
        r: Math.min(255, rgb.r + 180),
        g: Math.min(255, rgb.g + 180),
        b: Math.min(255, rgb.b + 180)
      };
      root.style.setProperty('--gradient-card-start', this.rgbToHex(gradientCardStartRgb.r, gradientCardStartRgb.g, gradientCardStartRgb.b));
      
      // Gradient overlay (dark version with opacity)
      const overlayRgb = {
        r: Math.max(0, rgb.r - 120),
        g: Math.max(0, rgb.g - 120),
        b: Math.max(0, rgb.b - 120)
      };
      root.style.setProperty('--gradient-overlay', `rgba(${overlayRgb.r}, ${overlayRgb.g}, ${overlayRgb.b}, 0.7)`);
    }
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

