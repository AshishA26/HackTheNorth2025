import { PinchButton } from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton";
import { GeminiAssistant } from "./GeminiAssistant";
import { OpenAIAssistant } from "./OpenAIAssistant";
import { Snap3DInteractableFactory } from "./Snap3DInteractableFactory";
import { SphereController } from "./SphereController";
import { LSTween } from "LSTween.lspkg/LSTween";
import Easing from "LSTween.lspkg/TweenJS/Easing";
import { setTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils";

enum AssistantType {
  Gemini = "Gemini",
  OpenAI = "OpenAI",
}

@component
export class AIAssistantUIBridge extends BaseScriptComponent {
  @ui.separator
  @ui.label("Connects the AI Assistant to the Sphere Controller UI")
  private assistantType: string = AssistantType.Gemini;
  @ui.separator
  @ui.group_start("Assistants")
  @ui.label(
    "Customize the voice and behavior of the assistants on their respective components."
  )
  @input
  private geminiAssistant: GeminiAssistant;

  @input
  private openAIAssistant: OpenAIAssistant;
  @ui.group_end
  @ui.separator
  @ui.group_start("UI Elements")
  @input
  private sphereController: SphereController;

  @input
  private snap3DInteractableFactory: Snap3DInteractableFactory;

  @input
  private hintTitle: Text;

  @input
  private hintText: Text;

  @input
  private geminiButton: PinchButton;
  @input
  private openAIButton: PinchButton;
  @ui.group_end
  private textIsVisible: boolean = true;
  private currentAssistant: GeminiAssistant | OpenAIAssistant;
  private isAIActive: boolean = false;
  private accumulatedGeminiText: string = "";

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  private onStart() {
    this.geminiButton.onButtonPinched.add(() => {
      if (!this.isAIActive) {
        // Start AI mode
        this.assistantType = AssistantType.Gemini;
        this.hintTitle.text = "Gemini Live Example";
        this.startWebsocketAndUI();
        this.isAIActive = true;
        this.updateButtonTexts();
      } else {
        // Exit AI mode
        this.exitAIMode();
      }
    });

    this.openAIButton.onButtonPinched.add(() => {
      this.assistantType = AssistantType.OpenAI;
      this.hintTitle.text = "OpenAI Realtime Example";
      this.startWebsocketAndUI();
    });
  }

  private hideButtons() {
    this.geminiButton.enabled = false;
    this.openAIButton.enabled = false;
    LSTween.scaleToLocal(
      this.geminiButton.sceneObject.getTransform(),
      vec3.zero(),
      500
    )
      .easing(Easing.Quadratic.Out)
      .onComplete(() => {
        this.geminiButton.sceneObject.enabled = false;
      })
      .start();

    LSTween.scaleToLocal(
      this.openAIButton.sceneObject.getTransform(),
      vec3.zero(),
      500
    )
      .easing(Easing.Quadratic.Out)
      .onComplete(() => {
        this.openAIButton.sceneObject.enabled = false;
      })
      .start();
  }

  private startWebsocketAndUI() {
    // this.hideButtons();
    this.hintText.text = "AI Assistant is now active - start talking!";
    if (global.deviceInfoSystem.isEditor()) {
      this.hintText.text = "AI Assistant is now active - start talking!";
    }
    this.sphereController.initializeUI();
    
    // Reset accumulated text for new conversation
    this.accumulatedGeminiText = "";
    // Set the current assistant based on selection
    this.currentAssistant =
      this.assistantType === AssistantType.Gemini
        ? this.geminiAssistant
        : this.openAIAssistant;

    if (this.assistantType === AssistantType.Gemini) {
      this.geminiAssistant.createGeminiLiveSession();
    } else if (this.assistantType === AssistantType.OpenAI) {
      this.openAIAssistant.createOpenAIRealtimeSession();
    }

    // Connect the selected assistant to the UI
    this.connectAssistantEvents();

    // Connect sphere controller activation to the current assistant
    this.sphereController.isActivatedEvent.add((isActivated) => {
      if (this.textIsVisible) {
        LSTween.textAlphaTo(this.hintTitle, 0, 600).start();
        LSTween.textAlphaTo(this.hintText, 0, 600).start();
        let bgColor = this.hintTitle.backgroundSettings.fill.color;
        LSTween.rawTween(600)
          .onUpdate((tweenData) => {
            let percent = tweenData.t as number;
            bgColor.a = 1 - percent;
            this.hintTitle.backgroundSettings.fill.color = bgColor;
          })
          .start();
      }
      this.textIsVisible = false;
      this.currentAssistant.streamData(isActivated);
      if (!isActivated) {
        this.currentAssistant.interruptAudioOutput();
      }
    });

    // Automatically activate the AI after a short delay
    setTimeout(() => {
      this.sphereController.isActivatedEvent.invoke(true);
    }, 1000); // 1 second delay to let the UI settle
  }

  private exitAIMode() {
    // Stop the current assistant
    if (this.currentAssistant) {
      this.currentAssistant.streamData(false);
      this.currentAssistant.interruptAudioOutput();
    }
    
    // Reset UI
    this.isAIActive = false;
    this.textIsVisible = true;
    this.hintTitle.text = "Select an AI Assistant";
    this.hintText.text = "Pinch Gemini to start";
    
    // Reset accumulated text
    this.accumulatedGeminiText = "";
    
    // Show only Gemini button, keep OpenAI hidden
    this.geminiButton.enabled = true;
    this.geminiButton.sceneObject.enabled = true;
    this.openAIButton.enabled = false;
    this.openAIButton.sceneObject.enabled = false;
    
    // Keep sphere controller enabled for text display
    this.sphereController.sceneObject.enabled = true;
    
    // Reset button texts
    this.updateButtonTexts();
  }

  private updateButtonTexts() {
    if (this.isAIActive) {
      // Change Gemini button text to "Exit AI Assist"
      this.geminiButton.sceneObject.getChild(0).getComponent("Component.Text").text = "Exit AI Assist";
    } else {
      // Reset Gemini button to "AI Assist"
      this.geminiButton.sceneObject.getChild(0).getComponent("Component.Text").text = "AI Assist";
    }
  }

  private checkGeminiResponse(text: string) {
    // Accumulate text from multiple messages
    this.accumulatedGeminiText += text;
    
    // Convert accumulated text to lowercase for case-insensitive matching
    const lowerText = this.accumulatedGeminiText.toLowerCase();
    
    // Check if Gemini mentions seeing an exit sign and says yes
    let isYes = lowerText.includes("yes") || lowerText.includes("yup") || lowerText.includes("yep") || lowerText.includes("yeah");
    if (lowerText.includes("exit") && lowerText.includes("sign") && isYes) {
      print("YES - Gemini sees an exit sign!");
      // Reset accumulated text to avoid multiple triggers
      this.accumulatedGeminiText = "";
      
      // Send hidden prompt to ask for steps
      this.askForStepsToWalk();
    }
    
    // You can add more response checks here
    if (isYes) {
      print("Gemini said: " + this.accumulatedGeminiText);
    }
  }

  private askForStepsToWalk() {
    // Send a hidden prompt to Gemini asking for steps to walk
    if (this.currentAssistant && this.assistantType === AssistantType.Gemini) {
      const hiddenPrompt = "How many steps do I need to walk to reach the exit sign? Please give me a specific number of steps and a direction.";
      
      // Wait 2 seconds before sending the hidden prompt
      setTimeout(() => {
        this.geminiAssistant.sendTextMessage(hiddenPrompt);
      }, 5000);
    }
  }

  private connectAssistantEvents() {
    // Connect text update events
    this.currentAssistant.updateTextEvent.add((data) => {
      this.sphereController.setText(data);
      
      // Check for specific responses from Gemini
      this.checkGeminiResponse(data.text);
    });

    // Connect function call events
    this.currentAssistant.functionCallEvent.add((data) => {
      if (data.name === "Snap3D") {
        // Send a response based on which assistant is active
        if (this.assistantType === AssistantType.Gemini) {
          this.geminiAssistant.sendFunctionCallUpdate(
            data.name,
            "Beginning to create 3D object..."
          );
        } else {
          this.openAIAssistant.sendFunctionCallUpdate(
            data.name,
            data.callId, // OpenAI requires a call_id
            "Beginning to create 3D object..."
          );
        }

        // Create the 3D object and handle the response
        this.snap3DInteractableFactory
          .createInteractable3DObject(data.args.prompt)
          .then((status) => {
            if (this.assistantType === AssistantType.Gemini) {
              this.geminiAssistant.sendFunctionCallUpdate(data.name, status);
            } else {
              this.openAIAssistant.sendFunctionCallUpdate(
                data.name,
                data.callId,
                status
              );
            }
          })
          .catch((error) => {
            if (this.assistantType === AssistantType.Gemini) {
              this.geminiAssistant.sendFunctionCallUpdate(data.name, error);
            } else {
              this.openAIAssistant.sendFunctionCallUpdate(
                data.name,
                data.callId,
                error
              );
            }
          });
      }
    });
  }
}
