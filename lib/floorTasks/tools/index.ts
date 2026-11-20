import type { Scope, ToolDefinition } from './scope';
import { lookUpStock, notAFloorTask, recipeAllergens, undoLast, whatsArriving, whatsLeftToMake } from './ask';
import { answerChecklist } from './checklist';
import { acceptDelivery, acceptTransfer, addToBasket, planOneOffDay } from './ordering';
import { addToHotBatch, markProduction } from './production';
import { requestStock, sendTransfer, setOnHand, setParLevel, stageWaste, startQuickCount } from './stock';

export function floorTools(scope: Scope): ToolDefinition[] {
  return [
    stageWaste(scope),
    setOnHand(scope),
    addToHotBatch(scope),
    markProduction(scope),
    setParLevel(scope),
    requestStock(scope),
    startQuickCount(scope),
    answerChecklist(scope),
    addToBasket(scope),
    acceptDelivery(scope),
    sendTransfer(scope),
    acceptTransfer(scope),
    planOneOffDay(scope),
    undoLast(scope),
    lookUpStock(scope),
    whatsArriving(scope),
    whatsLeftToMake(scope),
    recipeAllergens(scope),
    notAFloorTask(scope),
  ];
}
