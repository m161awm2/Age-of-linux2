export class EconomySystem {
  gold = 10;
  private accumulator = 0;

  update(deltaSeconds: number): void {
    this.accumulator += deltaSeconds;
    while (this.accumulator >= 1) {
      this.gold += 1;
      this.accumulator -= 1;
    }
  }

  canAfford(cost: number): boolean { return this.gold >= cost; }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.gold -= cost;
    return true;
  }

  reward(amount: number): void { this.gold += amount; }
}
