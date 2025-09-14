import { GeminiAPI } from "./GeminiAPI";
import { SpeechUI } from "./SpeechUI";
import { ResponseUI } from "./ResponseUI";
import { Loading } from "./Loading";
import { DepthCache } from "./DepthCache";
import { DebugVisualizer } from "./DebugVisualizer";
import { TargetBoxController } from "./TargetBoxController";

@component
export class SceneController extends BaseScriptComponent {
  @input
  @hint("Show debug visuals in the scene")
  showDebugVisuals: boolean = false;
  @input
  @hint("Visualizes 2D points over the camera frame for debugging")
  debugVisualizer: DebugVisualizer;
  @input
  @hint("Handles speech input and ASR")
  speechUI: SpeechUI;
  @input
  @hint("Calls to the Gemini API using Smart Gate")
  gemini: GeminiAPI;
  @input
  @hint("Displays AI speech output")
  responseUI: ResponseUI;
  @input
  @hint("Loading visual")
  loading: Loading;
  @input
  @hint("Caches depth frame and converts pixel positions to world space")
  depthCache: DepthCache;
  @input
  @hint("Controls the target box that highlights detections")
  targetBoxController: TargetBoxController = null;

  private isRequestRunning = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  onStart() {
    //    var tapEvent = this.createEvent("TapEvent");
    //    tapEvent.bind(() => {
    //      print("Editor tap event...");
    //      this.onSpeechRecieved("Can you show me all the objects you see?");
    //    });
    //
    //listen to new speech input
    this.speechUI.onSpeechReady.add((text) => {
      this.onSpeechRecieved(text);
    });
  }

  onSpeechRecieved(text: string) {
    this.speechUI.activateSpeechButton(false);
    if (this.isRequestRunning) {
      print("REQUEST ALREADY RUNNING");
      return;
    }
    print("MAKING REQUEST~~~~~");
    this.isRequestRunning = true;
    this.loading.activateLoder(true);
    //reset everything
    this.responseUI.clearLabels();
    this.responseUI.closeResponseBubble();
    //save depth frame
    let depthFrameID = this.depthCache.saveDepthFrame();
    let camImage = this.depthCache.getCamImageWithID(depthFrameID);
    //take capture
    this.sendToGemini(camImage, text, depthFrameID);
    if (this.showDebugVisuals) {
      this.debugVisualizer.updateCameraFrame(camImage);
    }
  }

  private sendToGemini(
    cameraFrame: Texture,
    text: string,
    depthFrameID: number
  ) {
    this.gemini.makeGeminiRequest(cameraFrame, text, (response) => {
      this.isRequestRunning = false;
      this.speechUI.activateSpeechButton(true);
      this.loading.activateLoder(false);
      print("GEMINI Points LENGTH: " + response.points.length);
      this.responseUI.openResponseBubble(response.aiMessage);
      //create points and labels
      var firstValidDetection = null;
      for (var i = 0; i < response.points.length; i++) {
        var pointObj = response.points[i];
        if (this.showDebugVisuals) {
          this.debugVisualizer.visualizeLocalPoint(
            pointObj.pixelPos,
            cameraFrame
          );
        }
        var worldPosition = this.depthCache.getWorldPositionWithID(
          pointObj.pixelPos,
          depthFrameID
        );
        if (worldPosition != null) {
          // Log xyz coordinates for each detection
          print(`Detection ${i + 1}: "${pointObj.label}"`);
          // print(`  Pixel Position: (${pointObj.pixelPos.x.toFixed(2)}, ${pointObj.pixelPos.y.toFixed(2)})`);
          print(`  World Position (XYZ): (${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);
          
          // Add xyz coordinates to the point object for potential future use
          pointObj.worldPosition = worldPosition;
          
          // Store the first valid detection for TargetBox
          if (firstValidDetection == null) {
            firstValidDetection = { worldPosition: worldPosition, label: pointObj.label };
          }
          
          //create and position label in world space
          this.responseUI.loadWorldLabel(
            pointObj.label,
            worldPosition,
            pointObj.showArrow
          );
        } else {
          print(`Detection ${i + 1}: "${pointObj.label}" - Could not determine world position (outside depth frame or invalid depth)`);
        }
      }
      
      // Move TargetBox to the first valid detection
      if (firstValidDetection != null && this.targetBoxController != null) {
        this.targetBoxController.moveToPosition(
          firstValidDetection.worldPosition, 
          firstValidDetection.label
        );
      } else if (this.targetBoxController != null) {
        // Hide TargetBox if no valid detections
        this.targetBoxController.hide();
      } else {
        print("TargetBoxController not connected - skipping TargetBox movement");
      }
      this.depthCache.disposeDepthFrame(depthFrameID);
    });
  }
}
