import type { City, NarrativeSlot } from '../model/types';
import { nextId } from './util';

/** Stub: reserva slots narrativos ligados a estruturas âncora se existirem. */
export function reserveNarrativeSlots(city: City): void {
  const slots: NarrativeSlot[] = [
    {
      id: nextId('narr'),
      key: 'doctor_henrique',
      structureId: null,
      note: 'Encontre o Dr. Henrique no hospital',
    },
    {
      id: nextId('narr'),
      key: 'police_report',
      structureId: null,
      note: 'Relatório na delegacia',
    },
  ];

  const hospital = city.structures.find((s) => s.typeId === 'hospital');
  const clinic = city.structures.find((s) => s.typeId === 'clinic');
  const police = city.structures.find((s) => s.typeId === 'police');

  if (hospital) slots[0]!.structureId = hospital.id;
  else if (clinic) slots[0]!.structureId = clinic.id;
  if (police) slots[1]!.structureId = police.id;

  city.narrativeSlots = slots;
}
