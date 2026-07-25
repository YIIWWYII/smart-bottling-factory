package com.archermind.hdc.filter;

import com.archermind.hdc.log.XLog;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import javax.servlet.*;
import javax.servlet.http.HttpFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;


@Order(1)
@Configuration
public class RequestFilter extends HttpFilter {
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        super.init(filterConfig);
        XLog.info("过滤器：接口日志过滤器启动");
    }

    private static final List<String> whiteList = Arrays.asList(
            "/doc.html",
            "/webjars/",
            "/swagger-resources",
            "/v2/api-docs",
            "/favicon.ico",
            "/device/checkInfo",
            "/statistics/devices"
    );

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        String uri = req.getRequestURI();
        boolean foo = checkInWhiteList(uri);
        if (foo) {
            XLog.debug("白名单URL访问：" + uri);
            super.doFilter(request, response, chain);
        } else {
            ContentCachingRequestWrapper requestWrapper = new ContentCachingRequestWrapper(req);
            ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(res);
            super.doFilter(requestWrapper, responseWrapper, chain);
            StringBuilder tmp = new StringBuilder("\n");
            tmp.append(uri);
            tmp.append("\n");
            tmp.append("请求内容：").append(new String(requestWrapper.getContentAsByteArray(), StandardCharsets.UTF_8));
            tmp.append("\n");
            tmp.append("响应内容：").append(new String(responseWrapper.getContentAsByteArray(), StandardCharsets.UTF_8));
            tmp.append("\n");
            XLog.info(tmp.toString());
            responseWrapper.copyBodyToResponse();
        }
    }

    @Override
    public void destroy() {
        super.destroy();
        XLog.info("过滤器：接口日志过滤器关闭");
    }


    private boolean checkInWhiteList(String path) {
        for (String item : whiteList) {
            boolean isMatched = path.contains(item);
            if (isMatched) {
                return true;
            }
        }
        return false;
    }

}
