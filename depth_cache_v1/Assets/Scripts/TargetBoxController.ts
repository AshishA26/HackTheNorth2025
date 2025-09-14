@component
export class TargetBoxController extends BaseScriptComponent {
  @input
  @hint("The target box object to move")
  targetBox: SceneObject;

  private targetBoxTransform: Transform = null;

  onAwake() {
    if (this.targetBox) {
      this.targetBoxTransform = this.targetBox.getTransform();
    }
  }

  /**
   * Move the target box to the specified world position
   * @param worldPosition The 3D world coordinates to move to
   * @param label Optional label to display (for debugging)
   */
  moveToPosition(worldPosition: vec3, label?: string) {
    if (this.targetBoxTransform) {
      this.targetBoxTransform.setWorldPosition(worldPosition);
      if (label) {
        print(`TargetBox moved to: ${label} at (${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);
      }
    } else {
      print("TargetBox transform not found!");
    }
  }

  /**
   * Hide the target box by moving it far away or disabling it
   */
  hide() {
    if (this.targetBoxTransform) {
      // Move far away to hide it
      this.targetBoxTransform.setWorldPosition(new vec3(0, -1000, 0));
    }
  }

  /**
   * Show the target box at the specified position
   * @param worldPosition The 3D world coordinates to show at
   * @param label Optional label to display
   */
  showAtPosition(worldPosition: vec3, label?: string) {
    this.moveToPosition(worldPosition, label);
  }
}
