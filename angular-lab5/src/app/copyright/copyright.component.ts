import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";

@Component({
  selector: 'copyright',
  templateUrl: './copyright.component.html',
  styleUrls: ['./copyright.component.css']
})

export class CopyrightComponent {

  constructor(private http: HttpClient) {}

  onCUSecAndPrivPolicy(text) {

    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'secAndPrivPolicy': text})
    }

    this.http.post('http://localhost:3000/api/copyright/cusecpolicy', JSON.stringify({'secAndPrivPolicy': text}), data)
    .subscribe(res => {

    })
  }

}
