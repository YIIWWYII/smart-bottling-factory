package com.archermind.hdc.operations.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.operations.dto.PackingRequest;
import com.archermind.hdc.operations.dto.PackingResponse;
import com.archermind.hdc.operations.service.PackingService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/operations/packing")
public class PackingController {
    private final PackingService service;

    public PackingController(PackingService service) { this.service = service; }

    @PostMapping("/calculate")
    public Result<PackingResponse> calculate(@RequestBody PackingRequest request) {
        try {
            return Result.success(service.calculate(request));
        } catch (RuntimeException exception) {
            return Result.message(exception.getMessage());
        }
    }
}
