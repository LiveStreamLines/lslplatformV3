import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CameraDetailComponent } from './camera-detail.component';

describe('CameraDetailComponent', () => {
  let component: CameraDetailComponent;
  let fixture: ComponentFixture<CameraDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CameraDetailComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CameraDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
