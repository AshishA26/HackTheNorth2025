import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";

@component
export class ASRController extends BaseScriptComponent {
  private asr: AsrModule = require("LensStudio:AsrModule");
  private options = null;
  private isListening = false;
  private useFallback = false; // Enable fallback mode for testing
  private simulationTimer = 0; // Timer for simulation
  //make an event for partial voice event that returns a string
  onPartialVoiceEvent = new Event<string>();
  onFinalVoiceEvent = new Event<string>();

  onAwake() {
    print("ASRController: Initializing...");
    this.testASRAvailability();
    
    try {
      this.options = AsrModule.AsrTranscriptionOptions.create();
      this.options.silenceUntilTerminationMs = 1000; // Increased silence timeout
      this.options.mode = AsrModule.AsrMode.Balanced;
      
      this.options.onTranscriptionUpdateEvent.add((args) => {
        if (args.isFinal) {
          print("Final Transcription: " + args.text);
          this.onFinalVoiceEvent.invoke(args.text);
        } else {
          print("Partial: " + args.text);
          this.onPartialVoiceEvent.invoke(args.text);
        }
      });
      
      this.options.onTranscriptionErrorEvent.add((args) => {
        print("ASR Error: " + args);
        this.isListening = false;
        // Try to provide more helpful error messages
        if (args === 1) {
          print("ASR Error 1: Permission denied or microphone not available");
          print("ASRController: Enabling fallback mode for testing");
          this.useFallback = true;
        } else if (args === 2) {
          print("ASR Error 2: Network error");
        } else if (args === 3) {
          print("ASR Error 3: Service unavailable");
        }
      });
      
      print("ASRController: Initialized successfully");
    } catch (error) {
      print("ASRController: Failed to initialize - " + error);
      print("ASRController: Enabling fallback mode for testing");
      this.useFallback = true;
    }
    
    // Set up update event for simulation
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
  }

  private testASRAvailability() {
    try {
      print("ASRController: Testing ASR module availability...");
      if (this.asr) {
        print("ASRController: ASR module loaded successfully");
      } else {
        print("ASRController: ASR module failed to load");
      }
    } catch (error) {
      print("ASRController: Error testing ASR availability - " + error);
    }
  }

  startListening() {
    if (this.isListening) {
      print("ASRController: Already listening, ignoring start request");
      return;
    }
    
    if (this.useFallback) {
      print("ASRController: Using fallback mode - simulating speech input");
      this.simulateSpeechInput();
      return;
    }
    
    if (!this.options) {
      print("ASRController: Options not initialized, cannot start listening");
      return;
    }
    
    try {
      print("ASRController: Starting transcription...");
      this.asr.startTranscribing(this.options);
      this.isListening = true;
      this.onPartialVoiceEvent.invoke("Listening...");
      print("ASRController: Transcription started successfully");
    } catch (error) {
      print("ASRController: Failed to start transcription - " + error);
      this.isListening = false;
    }
  }

  private simulateSpeechInput() {
    print("ASRController: Simulating speech input for testing...");
    this.isListening = true;
    this.simulationTimer = 0; // Reset timer
    this.onPartialVoiceEvent.invoke("Listening...");
  }

  private onUpdate() {
    if (this.useFallback && this.isListening) {
      this.simulationTimer += getDeltaTime();
      
      // After 2 seconds, show partial text
      if (this.simulationTimer >= 2.0 && this.simulationTimer < 3.0) {
        this.onPartialVoiceEvent.invoke("Can you show me all the objects you see?");
      }
      
      // After 3 seconds, show final text and stop listening
      if (this.simulationTimer >= 3.0) {
        this.onFinalVoiceEvent.invoke("Can you show me all the objects you see?");
        this.isListening = false;
        this.simulationTimer = 0;
      }
    }
  }

  stopListening() {
    if (!this.isListening) {
      print("ASRController: Not currently listening, ignoring stop request");
      return;
    }
    
    try {
      print("ASRController: Stopping transcription...");
      this.asr.stopTranscribing();
      this.isListening = false;
      print("ASRController: Transcription stopped successfully");
    } catch (error) {
      print("ASRController: Failed to stop transcription - " + error);
    }
  }
}
