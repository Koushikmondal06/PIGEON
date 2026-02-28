import { Contract } from '@algorandfoundation/algorand-typescript'

export class ContarctPigeon extends Contract {
  hello(name: string): string {
    return `Hello, ${name}`
  }
}
