package com.archermind.hdc.aiintegration.controller;

import com.archermind.hdc.aiintegration.dto.CommandIntentRequest;
import com.archermind.hdc.aiintegration.dto.VisionRecognitionRequest;
import com.archermind.hdc.aiintegration.model.VisionRecognitionRecord;
import com.archermind.hdc.aiintegration.service.AiIntegrationService;
import com.archermind.hdc.api.result.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/ai-integration")
public class AiIntegrationController {
    private final AiIntegrationService service;

    public AiIntegrationController(AiIntegrationService service) {
        this.service = service;
    }

    @GetMapping("/facts")
    public Result<Map<String, Object>> facts(@RequestHeader(value = "Authorization", required = false) String authorization,
                                             @RequestHeader(value = "X-Subject-Authorization", required = false) String subjectAuthorization,
                                             @RequestParam(required = false) String sourceApp,
                                             @RequestParam(required = false) String lineId,
                                             @RequestParam(required = false) String stageCode,
                                             @RequestParam(required = false) String deviceCode,
                                             @RequestParam(required = false) String traceCode) {
        return call(() -> service.facts(authorization, subjectAuthorization, sourceApp, lineId, stageCode, deviceCode, traceCode));
    }

    @PostMapping("/recognitions")
    public Result<VisionRecognitionRecord> recognitions(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                        @RequestBody VisionRecognitionRequest request) {
        return call(() -> service.recognize(authorization, request));
    }

    @PostMapping("/command-intents")
    public Result<Map<String, Object>> commandIntents(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                      @RequestHeader(value = "X-Subject-Authorization", required = false) String subjectAuthorization,
                                                      @RequestBody CommandIntentRequest request) {
        return call(() -> service.commandIntent(authorization, subjectAuthorization, request));
    }

    @GetMapping("/commands/{id}")
    public Result<Map<String, Object>> commandStatus(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                     @PathVariable String id) {
        return call(() -> service.commandStatus(authorization, id));
    }

    private <T> Result<T> call(Action<T> action) {
        try { return Result.success(action.run()); }
        catch (RuntimeException exception) { return Result.message(exception.getMessage()); }
    }

    private interface Action<T> { T run(); }
}
