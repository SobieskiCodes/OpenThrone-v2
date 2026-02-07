import { describe, it, expect } from 'vitest';
import { UnitTypes, getUnitByTypeAndLevel, getUnitsOfType } from '../units';
import { UnitType } from '@openthrone/shared';

describe('Unit Definitions', () => {
  it('should have 14 unit types defined', () => {
    expect(UnitTypes).toHaveLength(14);
  });

  it('should find Soldier as OFFENSE level 1', () => {
    const soldier = getUnitByTypeAndLevel(UnitType.OFFENSE, 1);
    expect(soldier).toBeDefined();
    expect(soldier?.name).toBe('Soldier');
    expect(soldier?.cost).toBe(1500);
  });

  it('should find Knight as OFFENSE level 2', () => {
    const knight = getUnitByTypeAndLevel(UnitType.OFFENSE, 2);
    expect(knight).toBeDefined();
    expect(knight?.name).toBe('Knight');
    expect(knight?.cost).toBe(10000);
  });

  it('should return undefined for nonexistent unit', () => {
    const unit = getUnitByTypeAndLevel(UnitType.OFFENSE, 99);
    expect(unit).toBeUndefined();
  });

  it('should get all offense units', () => {
    const offenseUnits = getUnitsOfType(UnitType.OFFENSE);
    expect(offenseUnits).toHaveLength(3);
    expect(offenseUnits.map((u) => u.name)).toEqual(['Soldier', 'Knight', 'Berserker']);
  });

  it('should have citizen as the first unit', () => {
    expect(UnitTypes[0]?.name).toBe('Citizen');
    expect(UnitTypes[0]?.type).toBe(UnitType.CITIZEN);
    expect(UnitTypes[0]?.cost).toBe(0);
  });
});
